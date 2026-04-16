import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.session_event import SessionEventCreate, SessionEventResponse
from app.services.rule_evaluation_service import RuleEvaluationService


class SessionEventService:
    def __init__(self) -> None:
        self.rule_evaluation_service = RuleEvaluationService()

    def create_event(self, db: Session, payload: SessionEventCreate) -> SessionEventResponse | None:
        session_row = db.execute(
            text(
                """
                SELECT
                  session_id,
                  started_at,
                  finished_at,
                  quiz_seconds,
                  quiz_score
                FROM learning_sessions
                WHERE session_id = :session_id
                """
            ),
            {"session_id": payload.session_id},
        ).mappings().first()
        if session_row is None:
            return None

        latest_event_row = db.execute(
            text(
                """
                SELECT
                  event_type,
                  event_timestamp
                FROM session_events
                WHERE session_id = :session_id
                ORDER BY event_timestamp DESC
                LIMIT 1
                """
            ),
            {"session_id": payload.session_id},
        ).mappings().first()

        event_id = str(uuid4())
        parsed_timestamp = datetime.fromisoformat(payload.event_timestamp)
        generated_flags: list[dict] = []
        self._validate_event(
            payload=payload,
            session_row=session_row,
            latest_event_row=latest_event_row,
            parsed_timestamp=parsed_timestamp,
        )

        db.execute(
            text(
                """
                INSERT INTO session_events (
                  event_id,
                  session_id,
                  event_type,
                  event_timestamp,
                  metadata_json
                ) VALUES (
                  :event_id,
                  :session_id,
                  :event_type,
                  :event_timestamp,
                  CAST(:metadata_json AS jsonb)
                )
                """
            ),
            {
                "event_id": event_id,
                "session_id": payload.session_id,
                "event_type": payload.event_type,
                "event_timestamp": parsed_timestamp,
                "metadata_json": json.dumps(payload.metadata_json),
            },
        )

        if payload.event_type == "context_switch":
            db.execute(
                text(
                    """
                    UPDATE learning_sessions
                    SET context_switch_count = context_switch_count + 1
                    WHERE session_id = :session_id
                    """
                ),
                {"session_id": payload.session_id},
            )
        elif payload.event_type == "card_swiped":
            db.execute(
                text(
                    """
                    UPDATE learning_sessions
                    SET cards_swiped = cards_swiped + 1
                    WHERE session_id = :session_id
                    """
                ),
                {"session_id": payload.session_id},
            )
        elif payload.event_type == "quiz_submitted":
            db.execute(
                text(
                    """
                    UPDATE learning_sessions
                    SET quiz_seconds = COALESCE(:quiz_seconds, quiz_seconds),
                        quiz_score = COALESCE(:quiz_score, quiz_score)
                    WHERE session_id = :session_id
                    """
                ),
                {
                    "session_id": payload.session_id,
                    "quiz_seconds": payload.metadata_json.get("quiz_seconds"),
                    "quiz_score": payload.metadata_json.get("quiz_score"),
                },
            )
        elif payload.event_type == "session_completed":
            db.execute(
                text(
                    """
                    UPDATE learning_sessions
                    SET finished_at = :finished_at,
                        duration_seconds = EXTRACT(EPOCH FROM (:finished_at - started_at))::INTEGER
                    WHERE session_id = :session_id
                    """
                ),
                {
                    "session_id": payload.session_id,
                    "finished_at": parsed_timestamp,
                },
            )

            generated_flags = self.rule_evaluation_service.evaluate_session(
                db=db,
                session_id=payload.session_id,
            )

        db.commit()

        return SessionEventResponse(
            event_id=event_id,
            session_id=payload.session_id,
            event_type=payload.event_type,
            event_timestamp=parsed_timestamp.isoformat(),
            metadata_json=payload.metadata_json,
            generated_flags=generated_flags,
        )

    @staticmethod
    def _validate_event(
        payload: SessionEventCreate,
        session_row: dict,
        latest_event_row: dict | None,
        parsed_timestamp: datetime,
    ) -> None:
        if parsed_timestamp < session_row["started_at"]:
            raise ValueError("Event timestamp cannot be earlier than session start time")

        if session_row["finished_at"] is not None and payload.event_type != "session_completed":
            raise ValueError("Session has already been completed")

        if latest_event_row is not None:
            if parsed_timestamp < latest_event_row["event_timestamp"]:
                raise ValueError("Event timestamp cannot be earlier than the latest session event")
            if payload.event_type == "session_started":
                raise ValueError("session_started cannot be submitted after other session events")

        if payload.event_type == "session_started":
            source = payload.metadata_json.get("source")
            if source is not None and (not isinstance(source, str) or not source.strip()):
                raise ValueError("session_started source must be a non-empty string")

        if payload.event_type == "card_swiped":
            card_index = payload.metadata_json.get("card_index")
            if card_index is None:
                raise ValueError("card_swiped requires card_index in metadata_json")
            if not isinstance(card_index, int) or card_index <= 0:
                raise ValueError("card_index must be a positive integer")

        if payload.event_type == "context_switch":
            target = payload.metadata_json.get("target")
            source = payload.metadata_json.get("source")
            if target is None or source is None:
                raise ValueError("context_switch requires target and source in metadata_json")
            if not isinstance(target, str) or not target.strip():
                raise ValueError("context_switch target must be a non-empty string")
            if not isinstance(source, str) or not source.strip():
                raise ValueError("context_switch source must be a non-empty string")

        if payload.event_type == "quiz_submitted":
            quiz_seconds = payload.metadata_json.get("quiz_seconds")
            quiz_score = payload.metadata_json.get("quiz_score")
            if quiz_seconds is None or quiz_score is None:
                raise ValueError("quiz_submitted requires quiz_seconds and quiz_score in metadata_json")
            if not isinstance(quiz_seconds, int) or quiz_seconds < 0:
                raise ValueError("quiz_seconds must be a non-negative integer")
            if not isinstance(quiz_score, int) or quiz_score < 0 or quiz_score > 100:
                raise ValueError("quiz_score must be an integer between 0 and 100")

        if payload.event_type == "session_completed":
            if session_row["finished_at"] is not None:
                raise ValueError("Session has already been completed")
            if parsed_timestamp <= session_row["started_at"]:
                raise ValueError("session_completed timestamp must be later than session start time")

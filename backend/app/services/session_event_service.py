import json
from datetime import datetime
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.session_event import SessionEventCreate, SessionEventResponse
from app.services.rule_evaluation_service import (
    BASE_MODULE_POINTS,
    WEEKLY_REVIEW_REWARD_POINTS,
    RuleEvaluationService,
)


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
        elif payload.event_type == "page_dwell_summary":
            db.execute(
                text(
                    """
                    UPDATE learning_sessions
                    SET context_switch_count = context_switch_count + COALESCE(:hidden_count, 0)
                    WHERE session_id = :session_id
                    """
                ),
                {
                    "session_id": payload.session_id,
                    "hidden_count": payload.metadata_json.get("hidden_count", 0),
                },
            )
        elif payload.event_type == "session_completed":
            db.execute(
                text(
                """
                UPDATE learning_sessions
                SET finished_at = :finished_at,
                        duration_seconds = EXTRACT(EPOCH FROM (:finished_at - started_at))::INTEGER,
                        leaderboard_points = :base_module_points,
                        weekly_reward_points = :weekly_reward_points,
                        streak_shield_locked = FALSE,
                        module_completion_frozen = FALSE
                    WHERE session_id = :session_id
                    """
                ),
                {
                    "session_id": payload.session_id,
                    "finished_at": parsed_timestamp,
                    "base_module_points": BASE_MODULE_POINTS,
                    "weekly_reward_points": WEEKLY_REVIEW_REWARD_POINTS,
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

        if payload.event_type == "answer_changed":
            question_id = payload.metadata_json.get("question_id")
            from_answer = payload.metadata_json.get("from_answer")
            to_answer = payload.metadata_json.get("to_answer")
            if question_id is None or from_answer is None or to_answer is None:
                raise ValueError(
                    "answer_changed requires question_id, from_answer and to_answer in metadata_json"
                )
            if not isinstance(question_id, str) or not question_id.strip():
                raise ValueError("answer_changed question_id must be a non-empty string")
            if not isinstance(from_answer, str) or not from_answer.strip():
                raise ValueError("answer_changed from_answer must be a non-empty string")
            if not isinstance(to_answer, str) or not to_answer.strip():
                raise ValueError("answer_changed to_answer must be a non-empty string")
            if from_answer == to_answer:
                raise ValueError("answer_changed from_answer and to_answer cannot be identical")

        if payload.event_type == "session_completed":
            if session_row["finished_at"] is not None:
                raise ValueError("Session has already been completed")
            if parsed_timestamp <= session_row["started_at"]:
                raise ValueError("session_completed timestamp must be later than session start time")

        if payload.event_type == "mouse_activity":
            move_count = payload.metadata_json.get("move_count")
            click_count = payload.metadata_json.get("click_count")
            scroll_count = payload.metadata_json.get("scroll_count")
            active_milliseconds = payload.metadata_json.get("active_milliseconds")
            if None in (move_count, click_count, scroll_count, active_milliseconds):
                raise ValueError(
                    "mouse_activity requires move_count, click_count, scroll_count and active_milliseconds in metadata_json"
                )
            for key, value in {
                "move_count": move_count,
                "click_count": click_count,
                "scroll_count": scroll_count,
                "active_milliseconds": active_milliseconds,
            }.items():
                if not isinstance(value, int) or value < 0:
                    raise ValueError(f"mouse_activity {key} must be a non-negative integer")

        if payload.event_type == "keyboard_activity":
            keydown_count = payload.metadata_json.get("keydown_count")
            shortcut_count = payload.metadata_json.get("shortcut_count", 0)
            active_milliseconds = payload.metadata_json.get("active_milliseconds")
            if keydown_count is None or active_milliseconds is None:
                raise ValueError(
                    "keyboard_activity requires keydown_count and active_milliseconds in metadata_json"
                )
            for key, value in {
                "keydown_count": keydown_count,
                "shortcut_count": shortcut_count,
                "active_milliseconds": active_milliseconds,
            }.items():
                if not isinstance(value, int) or value < 0:
                    raise ValueError(f"keyboard_activity {key} must be a non-negative integer")

        if payload.event_type == "page_visibility":
            visibility_state = payload.metadata_json.get("visibility_state")
            source = payload.metadata_json.get("source")
            if visibility_state is None or source is None:
                raise ValueError("page_visibility requires visibility_state and source in metadata_json")
            if visibility_state not in {"visible", "hidden"}:
                raise ValueError("page_visibility visibility_state must be visible or hidden")
            if not isinstance(source, str) or not source.strip():
                raise ValueError("page_visibility source must be a non-empty string")

        if payload.event_type == "page_dwell_summary":
            focused_seconds = payload.metadata_json.get("focused_seconds")
            hidden_seconds = payload.metadata_json.get("hidden_seconds")
            hidden_count = payload.metadata_json.get("hidden_count")
            if None in (focused_seconds, hidden_seconds, hidden_count):
                raise ValueError(
                    "page_dwell_summary requires focused_seconds, hidden_seconds and hidden_count in metadata_json"
                )
            for key, value in {
                "focused_seconds": focused_seconds,
                "hidden_seconds": hidden_seconds,
                "hidden_count": hidden_count,
            }.items():
                if not isinstance(value, int) or value < 0:
                    raise ValueError(f"page_dwell_summary {key} must be a non-negative integer")

        if payload.event_type in {"camera_monitor_started", "camera_monitor_stopped"}:
            source = payload.metadata_json.get("source")
            detector_name = payload.metadata_json.get("detector_name")
            if source is None or detector_name is None:
                raise ValueError(f"{payload.event_type} requires source and detector_name in metadata_json")
            if not isinstance(source, str) or not source.strip():
                raise ValueError(f"{payload.event_type} source must be a non-empty string")
            if not isinstance(detector_name, str) or not detector_name.strip():
                raise ValueError(f"{payload.event_type} detector_name must be a non-empty string")

        if payload.event_type in {"face_presence", "face_absence", "multiple_faces_detected"}:
            source = payload.metadata_json.get("source")
            detector_name = payload.metadata_json.get("detector_name")
            faces_detected = payload.metadata_json.get("faces_detected")
            if source is None or detector_name is None or faces_detected is None:
                raise ValueError(
                    f"{payload.event_type} requires source, detector_name and faces_detected in metadata_json"
                )
            if not isinstance(source, str) or not source.strip():
                raise ValueError(f"{payload.event_type} source must be a non-empty string")
            if not isinstance(detector_name, str) or not detector_name.strip():
                raise ValueError(f"{payload.event_type} detector_name must be a non-empty string")
            if not isinstance(faces_detected, int) or faces_detected < 0:
                raise ValueError(f"{payload.event_type} faces_detected must be a non-negative integer")

        if payload.event_type == "camera_monitor_summary":
            required_integer_fields = [
                "face_present_seconds",
                "face_absent_seconds",
                "longest_face_absence_seconds",
                "absence_count",
                "multiple_faces_seconds",
                "multiple_faces_detected_count",
            ]
            for field_name in required_integer_fields:
                value = payload.metadata_json.get(field_name)
                if value is None:
                    raise ValueError(f"camera_monitor_summary requires {field_name} in metadata_json")
                if not isinstance(value, int) or value < 0:
                    raise ValueError(f"camera_monitor_summary {field_name} must be a non-negative integer")
            for field_name in ["source", "detector_name"]:
                value = payload.metadata_json.get(field_name)
                if value is None:
                    raise ValueError(f"camera_monitor_summary requires {field_name} in metadata_json")
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(f"camera_monitor_summary {field_name} must be a non-empty string")

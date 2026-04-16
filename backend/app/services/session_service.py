from datetime import datetime
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.session import SessionCreateRequest, SessionCreateResponse


class SessionService:
    def create_session(self, db: Session, payload: SessionCreateRequest) -> SessionCreateResponse | None:
        agent_exists = db.execute(
            text(
                """
                SELECT agent_id
                FROM agents
                WHERE agent_id = :agent_id
                  AND is_active = TRUE
                """
            ),
            {"agent_id": payload.agent_id},
        ).scalar_one_or_none()
        if agent_exists is None:
            raise LookupError("Agent not found")

        course_exists = db.execute(
            text(
                """
                SELECT course_id
                FROM courses
                WHERE course_id = :course_id
                  AND is_active = TRUE
                """
            ),
            {"course_id": payload.course_id},
        ).scalar_one_or_none()
        if course_exists is None:
            raise LookupError("Course not found")

        parsed_started_at = datetime.fromisoformat(payload.started_at)
        session_id = str(uuid4())

        db.execute(
            text(
                """
                INSERT INTO learning_sessions (
                  session_id,
                  agent_id,
                  course_id,
                  started_at,
                  context_switch_count,
                  cards_swiped,
                  leaderboard_points,
                  streak_shield_locked
                ) VALUES (
                  :session_id,
                  :agent_id,
                  :course_id,
                  :started_at,
                  0,
                  0,
                  0,
                  FALSE
                )
                """
            ),
            {
                "session_id": session_id,
                "agent_id": payload.agent_id,
                "course_id": payload.course_id,
                "started_at": parsed_started_at,
            },
        )
        db.commit()

        return SessionCreateResponse(
            session_id=session_id,
            agent_id=payload.agent_id,
            course_id=payload.course_id,
            started_at=parsed_started_at.isoformat(),
            finished_at=None,
            duration_seconds=None,
            context_switch_count=0,
            cards_swiped=0,
            leaderboard_points=0,
            streak_shield_locked=False,
        )

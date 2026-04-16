from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    session_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    agent_id: Mapped[str] = mapped_column(String(32), ForeignKey("agents.agent_id"), nullable=False)
    course_id: Mapped[str] = mapped_column(String(50), ForeignKey("courses.course_id"), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    quiz_seconds: Mapped[int | None] = mapped_column(Integer)
    quiz_score: Mapped[int | None] = mapped_column(Integer)
    context_switch_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cards_swiped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    leaderboard_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    streak_shield_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
    )

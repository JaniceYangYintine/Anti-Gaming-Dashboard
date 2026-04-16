from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FlaggedSession(Base):
    __tablename__ = "flagged_sessions"

    flag_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    session_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("learning_sessions.session_id"),
        nullable=False,
    )
    agent_id: Mapped[str] = mapped_column(String(32), ForeignKey("agents.agent_id"), nullable=False)
    rule_violated_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("compliance_rules.rule_id"),
        nullable=False,
    )
    flag_timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
    )
    resolution_status: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "approved",
            "voided",
            "escalated_to_hr",
            name="resolution_status",
            create_type=False,
        ),
        nullable=False,
        default="pending",
    )
    severity_level: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", name="severity_level", create_type=False),
        nullable=False,
    )
    risk_reason: Mapped[str] = mapped_column(Text, nullable=False)
    leaderboard_points_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    streak_shield_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

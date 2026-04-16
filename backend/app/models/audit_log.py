from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ComplianceAuditLog(Base):
    __tablename__ = "compliance_audit_log"

    audit_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    flag_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("flagged_sessions.flag_id"),
        nullable=False,
    )
    manager_id: Mapped[str] = mapped_column(String(32), ForeignKey("managers.manager_id"), nullable=False)
    action_taken: Mapped[str] = mapped_column(
        Enum(
            "approved",
            "voided",
            "escalated_to_hr",
            name="action_taken",
            create_type=False,
        ),
        nullable=False,
    )
    manager_justification_notes: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
    )

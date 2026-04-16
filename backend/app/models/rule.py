from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, String, Text, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    rule_id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True)
    rule_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    rule_name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    parameter_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    severity_level: Mapped[str] = mapped_column(
        Enum("low", "medium", "high", name="severity_level", create_type=False),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("NOW()"),
    )

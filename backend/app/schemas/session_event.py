from typing import Any, Literal

from pydantic import BaseModel, Field


EventType = Literal[
    "session_started",
    "card_swiped",
    "answer_changed",
    "quiz_started",
    "quiz_submitted",
    "context_switch",
    "mouse_activity",
    "keyboard_activity",
    "page_visibility",
    "page_dwell_summary",
    "session_completed",
]


class SessionEventCreate(BaseModel):
    session_id: str = Field(min_length=1)
    event_type: EventType
    event_timestamp: str = Field(min_length=1)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class GeneratedFlagSummary(BaseModel):
    flag_id: str
    rule_code: str
    severity_level: str
    risk_reason: str


class SessionEventResponse(BaseModel):
    event_id: str
    session_id: str
    event_type: EventType
    event_timestamp: str
    metadata_json: dict[str, Any]
    generated_flags: list[GeneratedFlagSummary] = Field(default_factory=list)

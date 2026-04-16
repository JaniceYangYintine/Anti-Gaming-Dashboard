from typing import Literal

from pydantic import BaseModel, Field


SeverityLevel = Literal["low", "medium", "high"]
ResolutionStatus = Literal["pending", "approved", "voided", "escalated_to_hr"]


class FlagSummaryCounts(BaseModel):
    total_flags: int
    pending_flags: int
    severity_counts: dict[str, int]
    status_counts: dict[str, int]


class FlagListItem(BaseModel):
    flag_id: str
    session_id: str
    agent_id: str
    agent_name: str
    branch_name: str
    course_id: str
    course_name: str
    rule_id: str
    rule_code: str
    rule_name: str
    severity_level: SeverityLevel
    resolution_status: ResolutionStatus
    flag_timestamp: str
    risk_reason: str


class TimelineEntry(BaseModel):
    event_id: str
    event_type: str
    event_timestamp: str
    metadata_json: dict


class AuditLogEntry(BaseModel):
    audit_id: str
    manager_id: str
    manager_name: str
    action_taken: ResolutionStatus
    manager_justification_notes: str
    created_at: str


class RuleSnapshot(BaseModel):
    rule_id: str
    rule_code: str
    rule_name: str
    description: str
    parameter_json: dict
    severity_level: SeverityLevel


class SessionSnapshot(BaseModel):
    session_id: str
    started_at: str
    finished_at: str | None
    duration_seconds: int | None
    quiz_seconds: int | None
    quiz_score: int | None
    context_switch_count: int
    cards_swiped: int
    leaderboard_points: int
    streak_shield_locked: bool


class FlagDetail(BaseModel):
    flag: FlagListItem
    session: SessionSnapshot
    rule: RuleSnapshot
    timeline: list[TimelineEntry]
    audit_logs: list[AuditLogEntry]


class FlagListResponse(BaseModel):
    summary: FlagSummaryCounts
    items: list[FlagListItem]


class ResolutionRequest(BaseModel):
    manager_id: str = Field(min_length=1)
    action_taken: ResolutionStatus
    manager_justification_notes: str = Field(min_length=1)

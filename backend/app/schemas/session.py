from pydantic import BaseModel, Field


class SessionCreateRequest(BaseModel):
    agent_id: str = Field(min_length=1)
    course_id: str = Field(min_length=1)
    started_at: str = Field(min_length=1)


class SessionCreateResponse(BaseModel):
    session_id: str
    agent_id: str
    course_id: str
    started_at: str
    finished_at: str | None
    duration_seconds: int | None
    context_switch_count: int
    cards_swiped: int
    leaderboard_points: int
    weekly_reward_points: int
    streak_shield_locked: bool
    module_completion_frozen: bool


class RecentSessionItem(BaseModel):
    session_id: str
    agent_id: str
    agent_name: str
    branch_name: str
    course_id: str
    course_name: str
    started_at: str
    finished_at: str | None
    duration_seconds: int | None
    quiz_seconds: int | None
    quiz_score: int | None
    context_switch_count: int
    cards_swiped: int
    leaderboard_points: int
    weekly_reward_points: int
    streak_shield_locked: bool
    module_completion_frozen: bool
    event_count: int
    flag_count: int
    flag_rule_codes: list[str]
    latest_event_type: str | None
    latest_event_at: str | None
    session_status: str


class SessionFilterOption(BaseModel):
    value: str
    label: str


class RecentSessionsResponse(BaseModel):
    items: list[RecentSessionItem]
    agent_options: list[SessionFilterOption]
    course_options: list[SessionFilterOption]


class LeaderboardEntry(BaseModel):
    rank: int
    agent_id: str
    agent_name: str
    branch_name: str
    leaderboard_points: int
    weekly_reward_points: int
    total_points: int
    completed_sessions: int
    flagged_sessions: int


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardEntry]


class SessionTimelineEntry(BaseModel):
    event_id: str
    event_type: str
    event_timestamp: str
    metadata_json: dict


class SessionDetailResponse(BaseModel):
    session: RecentSessionItem
    timeline: list[SessionTimelineEntry]

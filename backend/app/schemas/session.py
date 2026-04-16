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
    streak_shield_locked: bool

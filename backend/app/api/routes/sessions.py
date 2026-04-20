from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.session import (
    LeaderboardResponse,
    RecentSessionsResponse,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionDetailResponse,
)
from app.services.session_service import SessionService


router = APIRouter()
session_service = SessionService()


@router.get("/recent", response_model=RecentSessionsResponse)
def list_recent_sessions(
    limit: int = 10,
    agent_id: str = "",
    course_id: str = "",
    db: Session = Depends(get_db),
) -> RecentSessionsResponse:
    return session_service.list_recent_sessions(
        db=db,
        limit=limit,
        agent_id=agent_id,
        course_id=course_id,
    )


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(limit: int = 10, db: Session = Depends(get_db)) -> LeaderboardResponse:
    return session_service.get_leaderboard(db=db, limit=limit)


@router.get("/{session_id}", response_model=SessionDetailResponse)
def get_session_detail(session_id: str, db: Session = Depends(get_db)) -> SessionDetailResponse:
    detail = session_service.get_session_detail(db=db, session_id=session_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return detail


@router.post("", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreateRequest,
    db: Session = Depends(get_db),
) -> SessionCreateResponse:
    try:
        return session_service.create_session(db=db, payload=payload)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

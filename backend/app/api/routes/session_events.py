from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.session_event import SessionEventCreate, SessionEventResponse
from app.services.session_event_service import SessionEventService


router = APIRouter()
session_event_service = SessionEventService()


@router.post("", response_model=SessionEventResponse, status_code=status.HTTP_201_CREATED)
def create_session_event(
    payload: SessionEventCreate,
    db: Session = Depends(get_db),
) -> SessionEventResponse:
    try:
        event = session_event_service.create_event(db=db, payload=payload)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    if event is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return event

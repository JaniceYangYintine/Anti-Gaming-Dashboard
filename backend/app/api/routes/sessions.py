from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.session import SessionCreateRequest, SessionCreateResponse
from app.services.session_service import SessionService


router = APIRouter()
session_service = SessionService()


@router.post("", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreateRequest,
    db: Session = Depends(get_db),
) -> SessionCreateResponse:
    try:
        return session_service.create_session(db=db, payload=payload)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

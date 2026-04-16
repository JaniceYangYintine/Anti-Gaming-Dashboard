from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.flag import FlagDetail, FlagListResponse, ResolutionRequest
from app.services.flag_service import FlagService


router = APIRouter()
flag_service = FlagService()


@router.get("", response_model=FlagListResponse)
def list_flags(
    severity: str = Query(default="all"),
    status: str = Query(default="all"),
    query: str = Query(default=""),
    db: Session = Depends(get_db),
) -> FlagListResponse:
    return flag_service.list_flags(db=db, severity=severity, status=status, query=query)


@router.get("/{flag_id}", response_model=FlagDetail)
def get_flag_detail(flag_id: str, db: Session = Depends(get_db)) -> FlagDetail:
    detail = flag_service.get_flag_detail(db=db, flag_id=flag_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return detail


@router.post("/{flag_id}/resolution", response_model=FlagDetail)
def submit_resolution(
    flag_id: str,
    payload: ResolutionRequest,
    db: Session = Depends(get_db),
) -> FlagDetail:
    try:
        detail = flag_service.submit_resolution(db=db, flag_id=flag_id, payload=payload)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error

    if detail is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return detail

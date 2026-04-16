from fastapi import APIRouter

from app.db.session import check_database_health


router = APIRouter()


@router.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    db_status = "ok" if check_database_health() else "unavailable"
    return {
        "status": "ok",
        "database": db_status,
    }

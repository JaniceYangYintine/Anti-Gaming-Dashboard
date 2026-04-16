from fastapi import APIRouter

from app.api.routes.flags import router as flags_router
from app.api.routes.health import router as health_router
from app.api.routes.rules import router as rules_router
from app.api.routes.sessions import router as sessions_router
from app.api.routes.session_events import router as session_events_router


api_router = APIRouter()
api_router.include_router(health_router)
api_router.include_router(rules_router, prefix="/api/v1/rules", tags=["rules"])
api_router.include_router(sessions_router, prefix="/api/v1/sessions", tags=["sessions"])
api_router.include_router(flags_router, prefix="/api/v1/flags", tags=["flags"])
api_router.include_router(session_events_router, prefix="/api/v1/session-events", tags=["session-events"])

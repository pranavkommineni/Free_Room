import logging
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api import admin, auth, availability, bookings, maintenance, notifications, rooms, schedule_changes, timetable, users
from app.core.config import settings
from app.core.database import engine
from app.core.exceptions import register_exception_handlers
from app.schemas.common import ErrorResponse

logging.basicConfig(level=logging.INFO)

DESCRIPTION = """
**FreeRoom** - find classrooms that are *genuinely* free.

`AVAILABLE = ACTIVE AND ACCESSIBLE AND no timetable class AND no booking AND no maintenance AND no restriction`

* **Auth**: `POST /api/v1/auth/login` -> click **Authorize** and paste the access token.
* **Roles**: STUDENT, FACULTY, ADMIN (each endpoint states its requirement).
* **Datetimes**: ISO-8601 *with* offset (e.g. `2026-10-05T10:00:00+05:30`). Responses are rendered in `Asia/Kolkata`.
* **Errors**: `{"success": false, "error": {"code", "message", "details"}}` (400/401/403/404/409/422/429/500).
"""

TAGS = [{"name": t} for t in ("Authentication", "Availability", "Bookings", "Timetable", "Schedule changes", "Rooms",
                              "Maintenance", "Restrictions", "Notifications", "Users (admin)", "Admin")]


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="FreeRoom API", version="1.0.0", description=DESCRIPTION, openapi_tags=TAGS, lifespan=lifespan)
register_exception_handlers(app)
app.add_middleware(CORSMiddleware, allow_origins=[settings.FRONTEND_URL], allow_credentials=True,
                   allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Authorization", "Content-Type"])

ERRORS = {c: {"model": ErrorResponse} for c in (400, 401, 403, 404, 409, 422)}
api = APIRouter(prefix="/api/v1", responses=ERRORS)
for r in (auth.router, users.router, rooms.buildings_router, rooms.router, availability.router, bookings.router, timetable.router,
          schedule_changes.router, maintenance.router, maintenance.restrictions_router, notifications.router, admin.router):
    api.include_router(r)
app.include_router(api)


@app.get("/health", tags=["Health"], summary="Liveness + DB connectivity")
async def health():
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return {"status": "ok", "environment": settings.ENVIRONMENT}

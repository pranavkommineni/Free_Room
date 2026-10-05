from typing import Any

from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog
from app.utils.pagination import PageParams, paginate


def snapshot(obj: Any, fields: list[str]) -> dict[str, Any]:
    """JSON-safe dict of selected attributes (dates/times become ISO strings)."""
    return jsonable_encoder({f: getattr(obj, f) for f in fields})


class AuditService:
    """record() adds to the caller's transaction - audit rows commit/rollback with the change itself."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def record(self, user_id: int | None, action: str, entity_type: str, entity_id: int | None,
               old: dict | None = None, new: dict | None = None) -> None:
        self.session.add(AuditLog(user_id=user_id, action=action, entity_type=entity_type, entity_id=entity_id,
                                  old_data=old, new_data=new))

    async def list(self, params: PageParams, entity_type: str | None = None, user_id: int | None = None, action: str | None = None):
        stmt = select(AuditLog)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if user_id:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if action:
            stmt = stmt.where(AuditLog.action == action)
        return await paginate(self.session, stmt.order_by(AuditLog.id.desc()), params)


ROOM_FIELDS = ["floor_id", "room_number", "capacity", "room_type", "has_ac", "has_projector", "student_accessible", "status"]
SLOT_FIELDS = ["course_id", "faculty_id", "room_id", "section_id", "day_of_week", "period_number", "start_time",
               "end_time", "academic_year", "semester", "is_active"]
CHANGE_FIELDS = ["timetable_slot_id", "change_type", "status", "original_date", "original_room_id", "original_start_time",
                 "original_end_time", "new_date", "new_room_id", "new_start_time", "new_end_time", "reason", "decision_note",
                 "requested_by", "approved_by"]
BOOKING_FIELDS = ["room_id", "user_id", "start_datetime", "end_datetime", "purpose", "status"]
BLOCK_FIELDS = ["room_id", "start_datetime", "end_datetime", "reason", "status"]

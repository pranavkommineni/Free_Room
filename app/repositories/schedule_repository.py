from datetime import date

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ScheduleChange
from app.models.enums import ChangeStatus


class ScheduleRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, change_id: int) -> ScheduleChange | None:
        stmt = select(ScheduleChange).where(ScheduleChange.id == change_id).execution_options(populate_existing=True)
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    async def get_for_update(self, change_id: int) -> ScheduleChange | None:
        stmt = select(ScheduleChange).where(ScheduleChange.id == change_id).with_for_update(of=ScheduleChange)
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    async def open_for_occurrence(self, slot_id: int, original_date: date) -> ScheduleChange | None:
        stmt = select(ScheduleChange).where(
            ScheduleChange.timetable_slot_id == slot_id, ScheduleChange.original_date == original_date,
            ScheduleChange.status.in_([ChangeStatus.PENDING.value, ChangeStatus.APPROVED.value]),
        )
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    def list_stmt(self, *, requested_by: int | None = None, status: str | None = None, slot_id: int | None = None) -> Select:
        stmt = select(ScheduleChange)
        if requested_by is not None:
            stmt = stmt.where(ScheduleChange.requested_by == requested_by)
        if status:
            stmt = stmt.where(ScheduleChange.status == status)
        if slot_id:
            stmt = stmt.where(ScheduleChange.timetable_slot_id == slot_id)
        return stmt.order_by(ScheduleChange.created_at.desc())

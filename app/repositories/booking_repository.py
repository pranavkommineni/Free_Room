from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RoomBooking
from app.models.enums import ACTIVE_BOOKING_STATUSES


class BookingRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, booking_id: int) -> RoomBooking | None:
        return await self.session.get(RoomBooking, booking_id)

    async def get_for_update(self, booking_id: int) -> RoomBooking | None:
        stmt = select(RoomBooking).where(RoomBooking.id == booking_id).with_for_update()
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def overlapping(self, room_ids: list[int], start: datetime, end: datetime, exclude_id: int | None = None) -> list[RoomBooking]:
        stmt = select(RoomBooking).where(
            RoomBooking.room_id.in_(room_ids), RoomBooking.status.in_(ACTIVE_BOOKING_STATUSES),
            RoomBooking.start_datetime < end, RoomBooking.end_datetime > start,
        )
        if exclude_id:
            stmt = stmt.where(RoomBooking.id != exclude_id)
        return list((await self.session.execute(stmt)).scalars())

    def list_stmt(self, *, user_id: int | None = None, room_id: int | None = None, status: str | None = None,
                  from_dt: datetime | None = None, to_dt: datetime | None = None) -> Select:
        stmt = select(RoomBooking)
        if user_id is not None:
            stmt = stmt.where(RoomBooking.user_id == user_id)
        if room_id is not None:
            stmt = stmt.where(RoomBooking.room_id == room_id)
        if status:
            stmt = stmt.where(RoomBooking.status == status)
        if from_dt:
            stmt = stmt.where(RoomBooking.end_datetime > from_dt)
        if to_dt:
            stmt = stmt.where(RoomBooking.start_datetime < to_dt)
        return stmt.order_by(RoomBooking.start_datetime.desc())

from datetime import datetime

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Building, Floor, Room, RoomMaintenance, RoomRestriction
from app.models.enums import BLOCKING_MAINTENANCE, RestrictionStatus, RoomStatus


class RoomRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, room_id: int) -> Room | None:
        stmt = select(Room).where(Room.id == room_id).execution_options(populate_existing=True)
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    async def get_for_update(self, room_id: int) -> Room | None:
        """Row-level lock: serialises concurrent booking / approval / maintenance transactions per room."""
        stmt = select(Room).where(Room.id == room_id).with_for_update(of=Room).execution_options(populate_existing=True)
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    def list_stmt(self, *, building_id: int | None = None, floor_id: int | None = None, status: str | None = None,
                  student_accessible: bool | None = None, minimum_capacity: int | None = None,
                  has_projector: bool | None = None, has_ac: bool | None = None) -> Select:
        stmt = select(Room).join(Floor, Floor.id == Room.floor_id)
        if building_id is not None:
            stmt = stmt.where(Floor.building_id == building_id)
        if floor_id is not None:
            stmt = stmt.where(Room.floor_id == floor_id)
        if status:
            stmt = stmt.where(Room.status == status)
        if student_accessible is not None:
            stmt = stmt.where(Room.student_accessible.is_(student_accessible))
        if minimum_capacity is not None:
            stmt = stmt.where(Room.capacity >= minimum_capacity)
        if has_projector is not None:
            stmt = stmt.where(Room.has_projector.is_(has_projector))
        if has_ac is not None:
            stmt = stmt.where(Room.has_ac.is_(has_ac))
        return stmt.order_by(Floor.building_id, Floor.floor_number, Room.room_number)

    async def candidates(self, **filters) -> list[Room]:
        stmt = self.list_stmt(status=RoomStatus.ACTIVE.value, **filters)
        return list((await self.session.execute(stmt)).scalars().unique())

    async def rooms_by_ids(self, ids: list[int]) -> dict[int, Room]:
        if not ids:
            return {}
        rows = (await self.session.execute(select(Room).where(Room.id.in_(ids)))).scalars().unique()
        return {r.id: r for r in rows}

    async def number_exists_in_building(self, building_id: int, room_number: str, exclude_id: int | None = None) -> bool:
        stmt = select(Room.id).join(Floor, Floor.id == Room.floor_id).where(Floor.building_id == building_id, Room.room_number == room_number)
        if exclude_id:
            stmt = stmt.where(Room.id != exclude_id)
        return (await self.session.execute(stmt.limit(1))).first() is not None

    async def get_floor(self, floor_id: int) -> Floor | None:
        return (await self.session.execute(select(Floor).where(Floor.id == floor_id))).unique().scalar_one_or_none()

    async def buildings_with_floors(self) -> list[tuple[Building, list[Floor]]]:
        buildings = (await self.session.execute(select(Building).order_by(Building.code))).scalars().all()
        floors = (await self.session.execute(select(Floor).order_by(Floor.building_id, Floor.floor_number))).scalars().unique().all()
        return [(b, [f for f in floors if f.building_id == b.id]) for b in buildings]

    # ---- blockers (all take the half-open overlap test: existing_start < end AND existing_end > start) ----
    async def maintenance_overlapping(self, room_ids: list[int], start: datetime, end: datetime) -> list[RoomMaintenance]:
        stmt = select(RoomMaintenance).where(
            RoomMaintenance.room_id.in_(room_ids), RoomMaintenance.status.in_(BLOCKING_MAINTENANCE),
            RoomMaintenance.start_datetime < end, RoomMaintenance.end_datetime > start,
        )
        return list((await self.session.execute(stmt)).scalars())

    async def restrictions_overlapping(self, room_ids: list[int], start: datetime, end: datetime) -> list[RoomRestriction]:
        stmt = select(RoomRestriction).where(
            RoomRestriction.room_id.in_(room_ids), RoomRestriction.status == RestrictionStatus.ACTIVE.value,
            RoomRestriction.start_datetime < end, RoomRestriction.end_datetime > start,
        )
        return list((await self.session.execute(stmt)).scalars())

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models import Building, Floor, Room, User
from app.models.enums import Role, RoomStatus
from app.repositories.room_repository import RoomRepository
from app.schemas.room import BuildingCreate, FloorCreate, RoomCreate, RoomUpdate
from app.services.audit_service import ROOM_FIELDS, AuditService, snapshot
from app.services.booking_service import BookingService
from app.utils.datetime_utils import now
from app.utils.pagination import PageParams, paginate
from datetime import timedelta


class RoomService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = RoomRepository(session)
        self.audit = AuditService(session)

    async def list(self, user: User, params: PageParams, **filters):
        if user.role == Role.STUDENT.value:  # students only ever see rooms they could actually use
            filters.update(student_accessible=True, status=RoomStatus.ACTIVE.value)
        return await paginate(self.session, self.repo.list_stmt(**filters), params)

    async def get(self, user: User, room_id: int) -> Room:
        room = await self.repo.get(room_id)
        if not room or (user.role == Role.STUDENT.value and (not room.student_accessible or room.status != RoomStatus.ACTIVE.value)):
            raise NotFoundError("Room not found.", code="ROOM_NOT_FOUND")
        return room

    async def create(self, actor: User, data: RoomCreate) -> Room:
        floor = await self.repo.get_floor(data.floor_id)
        if not floor:
            raise NotFoundError("Floor not found.", code="FLOOR_NOT_FOUND")
        if await self.repo.number_exists_in_building(floor.building_id, data.room_number):
            raise ConflictError(f"Room {data.room_number} already exists in this building.", code="ROOM_ALREADY_EXISTS")
        room = Room(**data.model_dump(mode="python"))
        room.room_type, room.status = data.room_type.value, data.status.value
        self.session.add(room)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("Room already exists.", code="ROOM_ALREADY_EXISTS")
        self.audit.record(actor.id, "ROOM_CREATED", "room", room.id, None, snapshot(room, ROOM_FIELDS))
        await self.session.commit()
        return await self.repo.get(room.id)  # type: ignore[return-value]

    async def update(self, actor: User, room_id: int, data: RoomUpdate) -> Room:
        room = await self.repo.get_for_update(room_id)
        if not room:
            raise NotFoundError("Room not found.", code="ROOM_NOT_FOUND")
        old = snapshot(room, ROOM_FIELDS)
        changes = data.model_dump(exclude_unset=True)
        if "room_number" in changes and await self.repo.number_exists_in_building(room.floor.building_id, changes["room_number"], room.id):
            raise ConflictError(f"Room {changes['room_number']} already exists in this building.", code="ROOM_ALREADY_EXISTS")
        for k, v in changes.items():
            setattr(room, k, v.value if hasattr(v, "value") else v)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("Room number already exists on this floor.", code="ROOM_ALREADY_EXISTS")
        if room.status == RoomStatus.INACTIVE.value:
            await BookingService(self.session).release_conflicting(actor.id, room.id, now(), now() + timedelta(days=365), "room was deactivated.")
        self.audit.record(actor.id, "ROOM_UPDATED", "room", room.id, old, snapshot(room, ROOM_FIELDS))
        await self.session.commit()
        return await self.repo.get(room.id)  # type: ignore[return-value]

    async def deactivate(self, actor: User, room_id: int) -> None:
        """DELETE = soft delete. Rooms are referenced by historical bookings/timetable so rows are never removed."""
        await self.update(actor, room_id, RoomUpdate(status=RoomStatus.INACTIVE))

    async def create_building(self, actor: User, data: BuildingCreate) -> Building:
        b = Building(name=data.name, code=data.code.upper())
        self.session.add(b)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("Building code already exists.", code="BUILDING_ALREADY_EXISTS")
        self.audit.record(actor.id, "BUILDING_CREATED", "building", b.id, None, {"name": b.name, "code": b.code})
        await self.session.commit()
        return b

    async def create_floor(self, actor: User, building_id: int, data: FloorCreate) -> Floor:
        if not await self.session.get(Building, building_id):
            raise NotFoundError("Building not found.", code="BUILDING_NOT_FOUND")
        f = Floor(building_id=building_id, floor_number=data.floor_number)
        self.session.add(f)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("Floor already exists.", code="FLOOR_ALREADY_EXISTS")
        self.audit.record(actor.id, "FLOOR_CREATED", "floor", f.id, None, {"building_id": building_id, "floor_number": f.floor_number})
        await self.session.commit()
        return f

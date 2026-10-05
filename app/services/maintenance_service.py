from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.models import RoomMaintenance, RoomRestriction, User
from app.models.enums import BLOCKING_MAINTENANCE, MaintenanceStatus, RestrictionStatus
from app.repositories.room_repository import RoomRepository
from app.schemas.maintenance import MaintenanceCreate, MaintenanceUpdate, RestrictionCreate
from app.services.audit_service import BLOCK_FIELDS, AuditService, snapshot
from app.services.booking_service import BookingService
from app.utils.pagination import PageParams, paginate


class _BlockBase:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.rooms = RoomRepository(session)
        self.audit = AuditService(session)
        self.bookings = BookingService(session)

    async def _lock_room(self, room_id: int):
        room = await self.rooms.get_for_update(room_id)  # same lock as booking => no booking can slip in
        if not room:
            raise NotFoundError("Room not found.", code="ROOM_NOT_FOUND")
        return room


class MaintenanceService(_BlockBase):
    async def create(self, actor: User, data: MaintenanceCreate) -> RoomMaintenance:
        await self._lock_room(data.room_id)
        m = RoomMaintenance(room_id=data.room_id, start_datetime=data.start_datetime, end_datetime=data.end_datetime,
                            reason=data.reason, reported_by=actor.id, status=MaintenanceStatus.SCHEDULED.value)
        self.session.add(m)
        await self.session.flush()
        released = await self.bookings.release_conflicting(actor.id, m.room_id, m.start_datetime, m.end_datetime,
                                                           f"maintenance - {m.reason}")
        self.audit.record(actor.id, "MAINTENANCE_CREATED", "room_maintenance", m.id, None,
                          {**snapshot(m, BLOCK_FIELDS), "bookings_cancelled": released})
        await self.session.commit()
        return m

    async def update(self, actor: User, mid: int, data: MaintenanceUpdate) -> RoomMaintenance:
        m = await self.session.get(RoomMaintenance, mid)
        if not m:
            raise NotFoundError("Maintenance record not found.")
        await self._lock_room(m.room_id)
        old = snapshot(m, BLOCK_FIELDS)
        for k, v in data.model_dump(exclude_unset=True).items():
            setattr(m, k, v.value if hasattr(v, "value") else v)
        if m.start_datetime >= m.end_datetime:
            raise ValidationAppError("start_datetime must be before end_datetime.", code="INVALID_INTERVAL")
        await self.session.flush()
        if m.status in BLOCKING_MAINTENANCE:
            await self.bookings.release_conflicting(actor.id, m.room_id, m.start_datetime, m.end_datetime, f"maintenance - {m.reason}")
        self.audit.record(actor.id, "MAINTENANCE_UPDATED", "room_maintenance", m.id, old, snapshot(m, BLOCK_FIELDS))
        await self.session.commit()
        return m

    async def cancel(self, actor: User, mid: int) -> None:
        m = await self.session.get(RoomMaintenance, mid)
        if not m:
            raise NotFoundError("Maintenance record not found.")
        old = snapshot(m, BLOCK_FIELDS)
        m.status = MaintenanceStatus.CANCELLED.value  # soft delete
        self.audit.record(actor.id, "MAINTENANCE_CANCELLED", "room_maintenance", m.id, old, snapshot(m, BLOCK_FIELDS))
        await self.session.commit()

    async def list(self, params: PageParams, room_id: int | None = None, status: str | None = None):
        stmt = select(RoomMaintenance)
        if room_id:
            stmt = stmt.where(RoomMaintenance.room_id == room_id)
        if status:
            stmt = stmt.where(RoomMaintenance.status == status)
        return await paginate(self.session, stmt.order_by(RoomMaintenance.start_datetime.desc()), params)


class RestrictionService(_BlockBase):
    async def create(self, actor: User, data: RestrictionCreate) -> RoomRestriction:
        await self._lock_room(data.room_id)
        r = RoomRestriction(room_id=data.room_id, start_datetime=data.start_datetime, end_datetime=data.end_datetime,
                            reason=data.reason, created_by=actor.id, status=RestrictionStatus.ACTIVE.value)
        self.session.add(r)
        await self.session.flush()
        released = await self.bookings.release_conflicting(actor.id, r.room_id, r.start_datetime, r.end_datetime,
                                                           f"restriction - {r.reason}")
        self.audit.record(actor.id, "RESTRICTION_CREATED", "room_restriction", r.id, None,
                          {**snapshot(r, BLOCK_FIELDS), "bookings_cancelled": released})
        await self.session.commit()
        return r

    async def lift(self, actor: User, rid: int) -> None:
        r = await self.session.get(RoomRestriction, rid)
        if not r:
            raise NotFoundError("Restriction not found.")
        if r.status != RestrictionStatus.ACTIVE.value:
            raise ConflictError("Restriction is not active.", code="INVALID_STATE")
        old = snapshot(r, BLOCK_FIELDS)
        r.status = RestrictionStatus.LIFTED.value  # soft delete
        self.audit.record(actor.id, "RESTRICTION_LIFTED", "room_restriction", r.id, old, snapshot(r, BLOCK_FIELDS))
        await self.session.commit()

    async def list(self, params: PageParams, room_id: int | None = None, status: str | None = None):
        stmt = select(RoomRestriction)
        if room_id:
            stmt = stmt.where(RoomRestriction.room_id == room_id)
        if status:
            stmt = stmt.where(RoomRestriction.status == status)
        return await paginate(self.session, stmt.order_by(RoomRestriction.start_datetime.desc()), params)

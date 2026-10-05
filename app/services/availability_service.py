"""AvailabilityService - the heart of FreeRoom.

AVAILABLE ROOM = ACTIVE ROOM AND STUDENT ACCESSIBLE AND NO TIMETABLE CONFLICT (effective schedule)
                 AND NO BOOKING CONFLICT AND NO MAINTENANCE CONFLICT AND NO RESTRICTION

Single code path for one room and for bulk search: blockers for all candidate rooms are loaded with a
fixed number of queries, then evaluated in memory with the half-open overlap rule
    existing_start < requested_end AND existing_end > requested_start
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

from fastapi.encoders import jsonable_encoder
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import NotFoundError, RoomNotAvailableError, ValidationAppError
from app.models import Room, User
from app.models.enums import Role, RoomStatus
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.timetable_repository import OccurrenceKey, TimetableRepository
from app.utils.datetime_utils import combine, overlaps, to_campus

BlockerKind = Literal["TIMETABLE", "BOOKING", "MAINTENANCE", "RESTRICTION"]
_CODES = {"TIMETABLE": "TIMETABLE_CONFLICT", "BOOKING": "BOOKING_CONFLICT",
          "MAINTENANCE": "MAINTENANCE_CONFLICT", "RESTRICTION": "RESTRICTION_CONFLICT"}


@dataclass(frozen=True)
class Blocker:
    kind: BlockerKind
    start: datetime
    end: datetime
    ref_id: int | None
    label: str


@dataclass(frozen=True)
class Conflict:
    code: str
    message: str
    start: datetime | None = None
    end: datetime | None = None
    ref_id: int | None = None

    def as_dict(self) -> dict[str, Any]:
        loc = lambda d: to_campus(d) if d else None  # noqa: E731  (render in campus time, not UTC)
        return jsonable_encoder({"code": self.code, "message": self.message, "start": loc(self.start), "end": loc(self.end), "ref_id": self.ref_id})


@dataclass(frozen=True)
class AvailableRoom:
    room: Room
    available_until: datetime


def validate_interval(start: datetime, end: datetime) -> None:
    if start.tzinfo is None or end.tzinfo is None:
        raise ValidationAppError("Datetimes must be timezone-aware.", code="NAIVE_DATETIME")
    if start >= end:
        raise ValidationAppError("start_datetime must be before end_datetime.", code="INVALID_INTERVAL")


class AvailabilityService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.rooms = RoomRepository(session)
        self.bookings = BookingRepository(session)
        self.timetable = TimetableRepository(session)

    # ---- loading --------------------------------------------------------------------------
    async def load_blockers(self, room_ids: list[int], start: datetime, horizon_end: datetime, *,
                            exclude_occurrences: set[OccurrenceKey] | None = None,
                            exclude_booking_id: int | None = None) -> dict[int, list[Blocker]]:
        out: dict[int, list[Blocker]] = {rid: [] for rid in room_ids}
        if not room_ids:
            return out
        for o in await self.timetable.effective_occurrences(start, horizon_end, room_ids=room_ids, exclude=exclude_occurrences):
            out[o.room_id].append(Blocker("TIMETABLE", o.start, o.end, o.slot_id, f"{o.course_code} class"))
        for b in await self.bookings.overlapping(room_ids, start, horizon_end, exclude_booking_id):
            out[b.room_id].append(Blocker("BOOKING", b.start_datetime, b.end_datetime, b.id, "existing booking"))
        for m in await self.rooms.maintenance_overlapping(room_ids, start, horizon_end):
            out[m.room_id].append(Blocker("MAINTENANCE", m.start_datetime, m.end_datetime, m.id, "maintenance"))
        for r in await self.rooms.restrictions_overlapping(room_ids, start, horizon_end):
            out[r.room_id].append(Blocker("RESTRICTION", r.start_datetime, r.end_datetime, r.id, "restriction"))
        return out

    # ---- evaluation -----------------------------------------------------------------------
    @staticmethod
    def evaluate(room: Room, blockers: list[Blocker], start: datetime, end: datetime, role: str | None) -> list[Conflict]:
        name = room.display_name
        conflicts: list[Conflict] = []
        if room.status != RoomStatus.ACTIVE.value:
            conflicts.append(Conflict("ROOM_INACTIVE", f"Room {name} is not active."))
        if role == Role.STUDENT.value and not room.student_accessible:
            conflicts.append(Conflict("ROOM_NOT_STUDENT_ACCESSIBLE", f"Room {name} is not accessible to students."))
        for b in blockers:
            if overlaps(b.start, b.end, start, end):
                conflicts.append(Conflict(_CODES[b.kind], f"Room {name} has a conflicting {b.label}.", b.start, b.end, b.ref_id))
        return conflicts

    async def check(self, room: Room, start: datetime, end: datetime, user: User | None = None, *,
                    exclude_occurrences: set[OccurrenceKey] | None = None,
                    exclude_booking_id: int | None = None) -> list[Conflict]:
        validate_interval(start, end)
        blockers = await self.load_blockers([room.id], start, end, exclude_occurrences=exclude_occurrences,
                                            exclude_booking_id=exclude_booking_id)
        return self.evaluate(room, blockers[room.id], start, end, user.role if user else None)

    async def check_room_id(self, room_id: int, start: datetime, end: datetime, user: User | None = None) -> tuple[Room, list[Conflict]]:
        room = await self.rooms.get(room_id)
        if not room:
            raise NotFoundError("Room not found.", code="ROOM_NOT_FOUND")
        return room, await self.check(room, start, end, user)

    async def assert_available(self, room: Room, start: datetime, end: datetime, user: User | None = None, **kw) -> None:
        conflicts = await self.check(room, start, end, user, **kw)
        if conflicts:
            raise RoomNotAvailableError(f"Room {room.display_name} is not available for the requested interval.",
                                        details=[c.as_dict() for c in conflicts])

    # ---- bulk search ----------------------------------------------------------------------
    async def find_available(self, start: datetime, end: datetime, user: User | None = None, *,
                             building_id: int | None = None, floor_id: int | None = None,
                             minimum_capacity: int | None = None, has_projector: bool | None = None,
                             has_ac: bool | None = None, entire_interval: bool = True) -> list[AvailableRoom]:
        """Rooms free for the ENTIRE [start, end). `available_until` = start of the next blocker at/after `end`
        (or campus closing time) - i.e. how long the room stays free beyond the request."""
        validate_interval(start, end)
        is_student = bool(user and user.role == Role.STUDENT.value)
        candidates = await self.rooms.candidates(
            building_id=building_id, floor_id=floor_id, minimum_capacity=minimum_capacity, has_projector=has_projector,
            has_ac=has_ac, student_accessible=True if is_student else None)
        day_close = combine(to_campus(start).date(), settings.CAMPUS_DAY_END)
        horizon = max(end, day_close)
        blockers = await self.load_blockers([r.id for r in candidates], start, horizon)
        result: list[AvailableRoom] = []
        for room in candidates:
            bl = blockers[room.id]
            if self.evaluate(room, bl, start, end, user.role if user else None):
                continue
            later = [b.start for b in bl if b.start >= end]
            result.append(AvailableRoom(room, min(later) if later else horizon))
        return result

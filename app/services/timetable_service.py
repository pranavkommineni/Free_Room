from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationAppError
from app.models import AcademicPeriod, Course, Faculty, Room, Section, TimetableSlot, User
from app.models.enums import Role, RoomStatus
from app.repositories.room_repository import RoomRepository
from app.repositories.timetable_repository import Occurrence, TimetableRepository
from app.repositories.user_repository import UserRepository
from app.schemas.timetable import (FreeInterval, FreePeriodsResponse, OccurrenceOut, PeriodCreate, PeriodStatus,
                                   SlotCreate, SlotUpdate)
from app.services.audit_service import SLOT_FIELDS, AuditService, snapshot
from app.services.booking_service import BookingService
from app.utils.datetime_utils import TZ, combine, local_dates, now, overlaps
from app.utils.pagination import PageParams, paginate

TIMETABLE_LOCK_KEY = 7_001  # pg_advisory_xact_lock key: serialises all timetable writes (slot create/update/import)


@dataclass(frozen=True)
class SlotKey:
    id: int | None
    course_id: int
    faculty_id: int
    room_id: int
    section_id: int
    day_of_week: int
    start_time: time
    end_time: time
    academic_year: str
    semester: str


def slot_key(s: TimetableSlot) -> SlotKey:
    return SlotKey(s.id, s.course_id, s.faculty_id, s.room_id, s.section_id, s.day_of_week, s.start_time, s.end_time,
                   s.academic_year, s.semester)


def find_slot_conflicts(cand: SlotKey, existing) -> list[tuple[str, str]]:
    """Pure function (also used by the CSV importer). Same term + same weekday + overlapping wall-clock times."""
    out: list[tuple[str, str]] = []
    for e in existing:
        if e.id is not None and e.id == cand.id:
            continue
        if (e.academic_year, e.semester, e.day_of_week) != (cand.academic_year, cand.semester, cand.day_of_week):
            continue
        if not (e.start_time < cand.end_time and e.end_time > cand.start_time):
            continue
        if (e.course_id, e.faculty_id, e.room_id, e.section_id, e.start_time, e.end_time) == \
                (cand.course_id, cand.faculty_id, cand.room_id, cand.section_id, cand.start_time, cand.end_time):
            out.append(("DUPLICATE_ENTRY", "Identical timetable entry already exists."))
            continue
        if e.room_id == cand.room_id:
            out.append(("ROOM_CONFLICT", "Room is already scheduled at this time."))
        if e.faculty_id == cand.faculty_id:
            out.append(("FACULTY_CONFLICT", "Faculty already teaches at this time."))
        if e.section_id == cand.section_id:
            out.append(("SECTION_CONFLICT", "Section already has a class at this time."))
    return out


class TimetableService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TimetableRepository(session)
        self.rooms = RoomRepository(session)
        self.users = UserRepository(session)
        self.audit = AuditService(session)

    # ---- effective schedule views --------------------------------------------------------------
    async def _to_out(self, occs: list[Occurrence]) -> list[OccurrenceOut]:
        rooms = await self.rooms.rooms_by_ids(list({o.room_id for o in occs}))
        return [OccurrenceOut(slot_id=o.slot_id, course_code=o.course_code, course_name=o.course_name, faculty_id=o.faculty_id,
                              section_id=o.section_id, room_id=o.room_id, room=rooms[o.room_id].display_name if o.room_id in rooms else None,
                              start=o.start, end=o.end, source=o.source, change_id=o.change_id) for o in occs]

    async def my_schedule(self, user: User, first: date, last: date) -> list[OccurrenceOut]:
        if last < first or (last - first).days > 31:
            raise ValidationAppError("Date range must be 0-31 days.", code="INVALID_RANGE")
        if user.role == Role.STUDENT.value:
            s = await self.users.student_by_user(user.id)
            if not s or s.section_id is None:
                return []
            occs = await self.repo.effective_for_dates(first, last, section_id=s.section_id)
        elif user.role == Role.FACULTY.value:
            f = await self.users.faculty_by_user(user.id)
            occs = await self.repo.effective_for_dates(first, last, faculty_id=f.id) if f else []
        else:
            raise ForbiddenError("Admins have no personal timetable; use /timetable/slots.")
        return await self._to_out(occs)

    async def _resolve_student(self, requester: User, student_id: int | None):
        if requester.role == Role.STUDENT.value:
            s = await self.users.student_by_user(requester.id)
            if student_id is not None and (not s or s.id != student_id):
                raise ForbiddenError("Students can only view their own free periods.")
        elif requester.role == Role.ADMIN.value:
            if student_id is None:
                raise ValidationAppError("student_id is required.", code="STUDENT_ID_REQUIRED")
            s = await self.users.student(student_id)
        else:
            raise ForbiddenError("Only students (own) or admins can view student free periods.")
        if not s:
            raise NotFoundError("Student not found.", code="STUDENT_NOT_FOUND")
        return s

    async def free_periods(self, requester: User, student_id: int | None, day: date) -> FreePeriodsResponse:
        student = await self._resolve_student(requester, student_id)
        periods = await self.repo.periods()
        if not periods:
            raise ValidationAppError("No academic periods configured.", code="PERIODS_NOT_CONFIGURED")
        if student.section_id is None:
            raise ValidationAppError("Student has no section assigned.", code="NO_SECTION")
        occs = await self.repo.effective_for_dates(day, day, section_id=student.section_id)
        rooms = await self.rooms.rooms_by_ids(list({o.room_id for o in occs}))
        out: list[PeriodStatus] = []
        for p in periods:
            a, b = combine(day, p.start_time), combine(day, p.end_time)
            hit = next((o for o in occs if overlaps(o.start, o.end, a, b)), None)
            out.append(PeriodStatus(period_number=p.period_number, start=a, end=b, status="CLASS" if hit else "FREE",
                                    course_code=hit.course_code if hit else None,
                                    room=rooms[hit.room_id].display_name if hit and hit.room_id in rooms else None))
        merged: list[FreeInterval] = []
        for p in out:
            if p.status != "FREE":
                continue
            if merged and merged[-1].end == p.start:
                merged[-1] = FreeInterval(start=merged[-1].start, end=p.end)
            else:
                merged.append(FreeInterval(start=p.start, end=p.end))
        return FreePeriodsResponse(student_id=student.id, date=day, periods=out, free_intervals=merged)

    async def student_class_conflicts(self, student_section_id: int | None, start: datetime, end: datetime) -> list[str]:
        if student_section_id is None:
            return []
        occs = await self.repo.effective_occurrences(start, end, section_id=student_section_id)
        return [f"{o.course_code} {o.start.astimezone(TZ):%H:%M}-{o.end.astimezone(TZ):%H:%M}" for o in occs]

    # ---- slot management (admin) ----------------------------------------------------------------
    async def _lock(self) -> None:
        await self.session.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": TIMETABLE_LOCK_KEY})

    async def _validate_refs(self, course_id: int, faculty_id: int, room_id: int, section_id: int) -> None:
        if not await self.session.get(Course, course_id):
            raise NotFoundError("Course not found.", code="COURSE_NOT_FOUND")
        if not await self.session.get(Faculty, faculty_id):
            raise NotFoundError("Faculty not found.", code="FACULTY_NOT_FOUND")
        room = await self.rooms.get(room_id)
        if not room:
            raise NotFoundError("Room not found.", code="ROOM_NOT_FOUND")
        if room.status != RoomStatus.ACTIVE.value:
            raise ConflictError("Room is not active.", code="ROOM_INACTIVE")
        if not await self.session.get(Section, section_id):
            raise NotFoundError("Section not found.", code="SECTION_NOT_FOUND")

    async def _assert_no_conflicts(self, key: SlotKey) -> None:
        existing = await self.repo.active_slots_for_terms({(key.academic_year, key.semester)})
        conflicts = find_slot_conflicts(key, [slot_key(s) for s in existing])
        if conflicts:
            raise ConflictError("Timetable conflict.", code=conflicts[0][0],
                                details=[{"code": c, "message": m} for c, m in dict.fromkeys(conflicts)])

    async def release_bookings_for_new_classes(self, actor: User, slots: list[TimetableSlot]) -> int:
        """A new/moved recurring class takes priority over room bookings inside the booking horizon."""
        if not slots:
            return 0
        bs = BookingService(self.session)
        by_room: dict[int, list[TimetableSlot]] = {}
        for s in slots:
            by_room.setdefault(s.room_id, []).append(s)
        horizon_end = now() + timedelta(days=settings.BOOKING_MAX_ADVANCE_DAYS + 1)
        released = 0
        for b in await bs.bookings.overlapping(list(by_room), now(), horizon_end):
            hit = any(d.weekday() == s.day_of_week and overlaps(combine(d, s.start_time), combine(d, s.end_time), b.start_datetime, b.end_datetime)
                      for s in by_room[b.room_id] for d in local_dates(b.start_datetime, b.end_datetime))
            if hit:
                await bs.cancel_system(actor.id, b, "a timetabled class was scheduled in this room.")
                released += 1
        return released

    async def create_slot(self, actor: User, data: SlotCreate) -> TimetableSlot:
        await self._lock()
        await self._validate_refs(data.course_id, data.faculty_id, data.room_id, data.section_id)
        key = SlotKey(None, data.course_id, data.faculty_id, data.room_id, data.section_id, data.day_of_week,
                      data.start_time, data.end_time, data.academic_year, data.semester)
        await self._assert_no_conflicts(key)
        slot = TimetableSlot(**data.model_dump())
        self.session.add(slot)
        await self.session.flush()
        await self.release_bookings_for_new_classes(actor, [slot])
        self.audit.record(actor.id, "TIMETABLE_SLOT_CREATED", "timetable_slot", slot.id, None, snapshot(slot, SLOT_FIELDS))
        await self.session.commit()
        return await self.repo.get_slot(slot.id)  # type: ignore[return-value]

    async def update_slot(self, actor: User, slot_id: int, data: SlotUpdate) -> TimetableSlot:
        await self._lock()
        slot = await self.repo.get_slot(slot_id)
        if not slot:
            raise NotFoundError("Timetable slot not found.")
        old = snapshot(slot, SLOT_FIELDS)
        changes = data.model_dump(exclude_unset=True)
        for k, v in changes.items():
            setattr(slot, k, v)
        if slot.start_time >= slot.end_time:
            raise ValidationAppError("start_time must be before end_time.", code="INVALID_INTERVAL")
        if slot.is_active:
            await self._validate_refs(slot.course_id, slot.faculty_id, slot.room_id, slot.section_id)
            await self._assert_no_conflicts(slot_key(slot))
            await self.session.flush()
            await self.release_bookings_for_new_classes(actor, [slot])
        self.audit.record(actor.id, "TIMETABLE_SLOT_UPDATED", "timetable_slot", slot.id, old, snapshot(slot, SLOT_FIELDS))
        await self.session.commit()
        return slot

    async def deactivate_slot(self, actor: User, slot_id: int) -> None:
        slot = await self.repo.get_slot(slot_id)
        if not slot:
            raise NotFoundError("Timetable slot not found.")
        old = snapshot(slot, SLOT_FIELDS)
        slot.is_active = False  # soft delete - history preserved
        self.audit.record(actor.id, "TIMETABLE_SLOT_DEACTIVATED", "timetable_slot", slot.id, old, snapshot(slot, SLOT_FIELDS))
        await self.session.commit()

    async def list_slots(self, actor: User, params: PageParams, *, room_id=None, faculty_id=None, section_id=None,
                         day_of_week=None, active_only=True):
        stmt = select(TimetableSlot)
        if actor.role == Role.FACULTY.value:
            f = await self.users.faculty_by_user(actor.id)
            faculty_id = f.id if f else -1  # faculty only see their own slots
        for col, val in ((TimetableSlot.room_id, room_id), (TimetableSlot.faculty_id, faculty_id),
                         (TimetableSlot.section_id, section_id), (TimetableSlot.day_of_week, day_of_week)):
            if val is not None:
                stmt = stmt.where(col == val)
        if active_only:
            stmt = stmt.where(TimetableSlot.is_active.is_(True))
        return await paginate(self.session, stmt.order_by(TimetableSlot.day_of_week, TimetableSlot.start_time, TimetableSlot.id), params)

    # ---- period grid ------------------------------------------------------------------------------
    async def upsert_period(self, actor: User, data: PeriodCreate) -> AcademicPeriod:
        if data.start_time >= data.end_time:
            raise ValidationAppError("start_time must be before end_time.", code="INVALID_INTERVAL")
        p = (await self.session.execute(select(AcademicPeriod).where(AcademicPeriod.period_number == data.period_number))).scalar_one_or_none()
        old = None
        if p:
            old = {"start_time": str(p.start_time), "end_time": str(p.end_time), "label": p.label}
            p.start_time, p.end_time, p.label, p.is_active = data.start_time, data.end_time, data.label, True
        else:
            p = AcademicPeriod(**data.model_dump())
            self.session.add(p)
        await self.session.flush()
        self.audit.record(actor.id, "PERIOD_UPSERTED", "academic_period", p.id, old,
                          {"period_number": p.period_number, "start_time": str(p.start_time), "end_time": str(p.end_time)})
        await self.session.commit()
        return p

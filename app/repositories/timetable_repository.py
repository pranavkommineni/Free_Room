from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AcademicPeriod, ScheduleChange, TimetableSlot
from app.models.enums import ChangeStatus, ChangeType
from app.utils.datetime_utils import combine, local_dates, overlaps

OccurrenceKey = tuple[int, date]  # (timetable_slot_id, original_date)


@dataclass(frozen=True)
class Occurrence:
    slot_id: int
    course_id: int
    course_code: str
    course_name: str
    faculty_id: int
    section_id: int
    room_id: int
    start: datetime
    end: datetime
    original_date: date
    source: str  # REGULAR or the ChangeType that produced it
    change_id: int | None = None


class TimetableRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_slot(self, slot_id: int) -> TimetableSlot | None:
        stmt = select(TimetableSlot).where(TimetableSlot.id == slot_id).execution_options(populate_existing=True)
        return (await self.session.execute(stmt)).unique().scalar_one_or_none()

    async def periods(self) -> list[AcademicPeriod]:
        stmt = select(AcademicPeriod).where(AcademicPeriod.is_active.is_(True)).order_by(AcademicPeriod.period_number)
        return list((await self.session.execute(stmt)).scalars())

    async def active_slots_for_terms(self, terms: set[tuple[str, str]]) -> list[TimetableSlot]:
        if not terms:
            return []
        cond = or_(*[(TimetableSlot.academic_year == ay) & (TimetableSlot.semester == sem) for ay, sem in terms])
        stmt = select(TimetableSlot).where(TimetableSlot.is_active.is_(True), cond)
        return list((await self.session.execute(stmt)).scalars().unique())

    # ------------------------------------------------------------------------------------------
    # EFFECTIVE SCHEDULE:  regular slots  +  approved exceptions  -  cancelled / moved-away occurrences
    # ------------------------------------------------------------------------------------------
    async def effective_occurrences(
        self, start: datetime, end: datetime, *,
        room_ids: list[int] | None = None, faculty_id: int | None = None, section_id: int | None = None,
        exclude: set[OccurrenceKey] | None = None,
    ) -> list[Occurrence]:
        """Class occurrences overlapping [start, end) after applying APPROVED schedule changes.

        `exclude` removes specific (slot_id, original_date) occurrences - used when validating a proposed
        change so the occurrence being moved doesn't conflict with itself."""
        exclude = exclude or set()
        dates = local_dates(start, end)
        weekdays = {d.weekday() for d in dates}

        slot_q = select(TimetableSlot).where(TimetableSlot.is_active.is_(True), TimetableSlot.day_of_week.in_(weekdays))
        if room_ids is not None:
            slot_q = slot_q.where(TimetableSlot.room_id.in_(room_ids))
        if faculty_id is not None:
            slot_q = slot_q.where(TimetableSlot.faculty_id == faculty_id)
        if section_id is not None:
            slot_q = slot_q.where(TimetableSlot.section_id == section_id)
        slots = (await self.session.execute(slot_q)).scalars().unique().all()

        change_q = select(ScheduleChange).where(
            ScheduleChange.status == ChangeStatus.APPROVED.value,
            or_(ScheduleChange.original_date.in_(dates), ScheduleChange.new_date.in_(dates)),
        )
        changes = (await self.session.execute(change_q)).scalars().unique().all()
        superseded: set[OccurrenceKey] = {(c.timetable_slot_id, c.original_date) for c in changes}

        out: list[Occurrence] = []
        for s in slots:
            for d in dates:
                if d.weekday() != s.day_of_week or (s.id, d) in superseded or (s.id, d) in exclude:
                    continue
                a, b = combine(d, s.start_time), combine(d, s.end_time)
                if overlaps(a, b, start, end):
                    out.append(Occurrence(s.id, s.course_id, s.course.course_code, s.course.course_name,
                                          s.faculty_id, s.section_id, s.room_id, a, b, d, "REGULAR"))
        for c in changes:
            if c.change_type == ChangeType.CANCELLED.value or c.new_date not in dates:
                continue
            if (c.timetable_slot_id, c.original_date) in exclude:
                continue
            s = c.slot
            if faculty_id is not None and s.faculty_id != faculty_id:
                continue
            if section_id is not None and s.section_id != section_id:
                continue
            if room_ids is not None and c.new_room_id not in room_ids:
                continue
            a, b = combine(c.new_date, c.new_start_time), combine(c.new_date, c.new_end_time)
            if overlaps(a, b, start, end):
                out.append(Occurrence(s.id, s.course_id, s.course.course_code, s.course.course_name, s.faculty_id,
                                      s.section_id, c.new_room_id, a, b, c.original_date, c.change_type, c.id))
        return sorted(out, key=lambda o: (o.start, o.slot_id))

    async def effective_for_dates(self, first: date, last: date, **filters) -> list[Occurrence]:
        start = combine(first, time(0, 0))
        end = combine(last, time(0, 0)) + timedelta(days=1)
        return await self.effective_occurrences(start, end, **filters)

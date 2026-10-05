from collections import defaultdict
from datetime import datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ValidationAppError
from app.models import Room, RoomBooking, User
from app.models.enums import ACTIVE_BOOKING_STATUSES, BookingStatus, Role, RoomStatus
from app.repositories.timetable_repository import TimetableRepository
from app.schemas.analytics import BookingAnalytics, RoomAnalytics, RoomUtilization, UtilizationAnalytics
from app.services.availability_service import AvailabilityService
from app.utils.datetime_utils import combine, now, to_campus

MAX_RANGE_DAYS = 92


class AnalyticsService:
    """All numbers are computed from stored rows (bookings, timetable, exceptions). Nothing is fabricated."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    @staticmethod
    def _range(start: datetime | None, end: datetime | None, default_back: int, default_fwd: int = 0):
        n = now()
        start, end = start or n - timedelta(days=default_back), end or n + timedelta(days=default_fwd)
        if start >= end:
            raise ValidationAppError("range start must be before range end.", code="INVALID_RANGE")
        if (end - start).days > MAX_RANGE_DAYS:
            raise ValidationAppError(f"Range may not exceed {MAX_RANGE_DAYS} days.", code="INVALID_RANGE")
        return start, end

    async def rooms(self, admin: User) -> RoomAnalytics:
        counts = dict((await self.session.execute(select(Room.status, func.count()).group_by(Room.status))).all())
        active = counts.get(RoomStatus.ACTIVE.value, 0)
        n = now()
        free = await AvailabilityService(self.session).find_available(n, n + timedelta(minutes=1), admin)
        return RoomAnalytics(total_rooms=sum(counts.values()), active_rooms=active, inactive_rooms=counts.get(RoomStatus.INACTIVE.value, 0),
                             available_now=len(free), occupied_now=active - len(free), as_of=n)

    async def bookings(self, start: datetime | None, end: datetime | None) -> BookingAnalytics:
        start, end = self._range(start, end, 30, 30)
        in_range = RoomBooking.start_datetime >= start, RoomBooking.start_datetime < end
        by_status = dict((await self.session.execute(
            select(RoomBooking.status, func.count()).where(*in_range).group_by(RoomBooking.status))).all())
        n = now()
        active_now = (await self.session.execute(select(func.count()).select_from(RoomBooking).where(
            RoomBooking.status == BookingStatus.CONFIRMED.value, RoomBooking.start_datetime <= n, RoomBooking.end_datetime > n))).scalar_one()
        upcoming = (await self.session.execute(select(func.count()).select_from(RoomBooking).where(
            RoomBooking.status == BookingStatus.CONFIRMED.value, RoomBooking.start_datetime > n))).scalar_one()
        total = sum(by_status.values())
        cancelled = by_status.get(BookingStatus.CANCELLED.value, 0)
        return BookingAnalytics(range_start=start, range_end=end, total_bookings=total, by_status=by_status,
                                active_bookings_now=active_now, upcoming_bookings=upcoming, cancellation_count=cancelled,
                                cancellation_rate=round(cancelled / total, 4) if total else 0.0)

    async def utilization(self, start: datetime | None, end: datetime | None, top_n: int = 5) -> UtilizationAnalytics:
        start, end = self._range(start, end, 30, 0)
        rooms = (await self.session.execute(select(Room).where(Room.status == RoomStatus.ACTIVE.value))).scalars().unique().all()
        # booked hours (CONFIRMED bookings clipped to the range)
        hours = func.sum(func.extract("epoch", func.least(RoomBooking.end_datetime, end) - func.greatest(RoomBooking.start_datetime, start)) / 3600)
        rows = (await self.session.execute(select(RoomBooking.room_id, hours, func.count()).where(
            RoomBooking.status == BookingStatus.CONFIRMED.value, RoomBooking.end_datetime > start, RoomBooking.start_datetime < end
        ).group_by(RoomBooking.room_id))).all()
        booked = {rid: (float(h or 0), c) for rid, h, c in rows}
        # class hours from the EFFECTIVE schedule (exceptions applied)
        class_hours: dict[int, float] = defaultdict(float)
        for o in await TimetableRepository(self.session).effective_occurrences(start, end):
            class_hours[o.room_id] += (min(o.end, end) - max(o.start, start)).total_seconds() / 3600
        # denominator: working days in range x campus operating hours
        days = {(to_campus(start) + timedelta(days=i)).date() for i in range((to_campus(end).date() - to_campus(start).date()).days + 1)}
        working = sum(1 for d in days if d.weekday() in settings.WORKING_DAYS)
        per_day = (combine(next(iter(days)), settings.CAMPUS_DAY_END) - combine(next(iter(days)), settings.CAMPUS_DAY_START)).total_seconds() / 3600
        capacity_hours = working * per_day
        out = []
        for r in rooms:
            b, c = booked.get(r.id, (0.0, 0))
            total = b + class_hours.get(r.id, 0.0)
            out.append(RoomUtilization(room_id=r.id, display_name=r.display_name, booked_hours=round(b, 2),
                                       class_hours=round(class_hours.get(r.id, 0.0), 2), total_hours=round(total, 2),
                                       utilization_pct=round(min(100.0, total / capacity_hours * 100), 2) if capacity_hours else 0.0,
                                       booking_count=c))
        ranked = sorted(out, key=lambda x: (-x.total_hours, x.display_name))
        return UtilizationAnalytics(range_start=start, range_end=end, working_days=working, available_hours_per_room=round(capacity_hours, 2),
                                    rooms=ranked, most_used=ranked[:top_n], least_used=list(reversed(ranked[-top_n:])))

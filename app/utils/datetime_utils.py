"""Timezone helpers. All stored datetimes are timestamptz (UTC internally);
all *local wall-clock* reasoning (timetable days/periods) uses settings.TIMEZONE."""
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings

TZ = ZoneInfo(settings.TIMEZONE)


def now() -> datetime:
    return datetime.now(TZ)


def to_campus(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        raise ValueError("naive datetime is not allowed")
    return dt.astimezone(TZ)


def combine(d: date, t: time) -> datetime:
    """Local date + local wall-clock time -> aware datetime."""
    return datetime.combine(d, t.replace(tzinfo=None), tzinfo=TZ)


def overlaps(a_start: datetime, a_end: datetime, b_start: datetime, b_end: datetime) -> bool:
    """Half-open interval overlap: existing_start < requested_end AND existing_end > requested_start."""
    return a_start < b_end and a_end > b_start


def local_dates(start: datetime, end: datetime) -> list[date]:
    """Local calendar dates touched by [start, end)."""
    first = to_campus(start).date()
    last = to_campus(end - timedelta(microseconds=1)).date()
    return [first + timedelta(days=i) for i in range((last - first).days + 1)]

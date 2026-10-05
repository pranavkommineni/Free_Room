from enum import StrEnum


class Role(StrEnum):
    STUDENT = "STUDENT"
    FACULTY = "FACULTY"
    ADMIN = "ADMIN"


class RoomStatus(StrEnum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"


class RoomType(StrEnum):
    CLASSROOM = "CLASSROOM"
    LAB = "LAB"
    SEMINAR_HALL = "SEMINAR_HALL"
    AUDITORIUM = "AUDITORIUM"
    OTHER = "OTHER"


class BookingStatus(StrEnum):
    PENDING = "PENDING"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


# statuses that block a room
ACTIVE_BOOKING_STATUSES = (BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value)


class ChangeType(StrEnum):
    RESCHEDULED = "RESCHEDULED"
    CANCELLED = "CANCELLED"
    ROOM_CHANGED = "ROOM_CHANGED"
    TIME_CHANGED = "TIME_CHANGED"


class ChangeStatus(StrEnum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"


class MaintenanceStatus(StrEnum):
    SCHEDULED = "SCHEDULED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


BLOCKING_MAINTENANCE = (MaintenanceStatus.SCHEDULED.value, MaintenanceStatus.IN_PROGRESS.value)


class RestrictionStatus(StrEnum):
    ACTIVE = "ACTIVE"
    LIFTED = "LIFTED"


class NotificationType(StrEnum):
    BOOKING_CONFIRMED = "BOOKING_CONFIRMED"
    BOOKING_CANCELLED = "BOOKING_CANCELLED"
    CLASS_RESCHEDULED = "CLASS_RESCHEDULED"
    CLASS_CANCELLED = "CLASS_CANCELLED"
    RESCHEDULE_REQUESTED = "RESCHEDULE_REQUESTED"
    RESCHEDULE_APPROVED = "RESCHEDULE_APPROVED"
    RESCHEDULE_REJECTED = "RESCHEDULE_REJECTED"
    ROOM_UNAVAILABLE = "ROOM_UNAVAILABLE"


class ImportStatus(StrEnum):
    PENDING = "PENDING"
    COMMITTED = "COMMITTED"
    DISCARDED = "DISCARDED"


def check_in(column: str, enum: type[StrEnum]) -> str:
    """SQL fragment for a CHECK (column IN (...)) constraint."""
    return f"{column} IN ({', '.join(repr(e.value) for e in enum)})"

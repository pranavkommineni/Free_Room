from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORM, OutDT


class RoomAnalytics(BaseModel):
    total_rooms: int
    active_rooms: int
    inactive_rooms: int
    available_now: int
    occupied_now: int
    as_of: OutDT


class BookingAnalytics(BaseModel):
    range_start: OutDT
    range_end: OutDT
    total_bookings: int
    by_status: dict[str, int]
    active_bookings_now: int
    upcoming_bookings: int
    cancellation_count: int
    cancellation_rate: float


class RoomUtilization(BaseModel):
    room_id: int
    display_name: str
    booked_hours: float
    class_hours: float
    total_hours: float
    utilization_pct: float
    booking_count: int


class UtilizationAnalytics(BaseModel):
    range_start: OutDT
    range_end: OutDT
    working_days: int
    available_hours_per_room: float
    rooms: list[RoomUtilization]
    most_used: list[RoomUtilization]
    least_used: list[RoomUtilization]


class AuditLogOut(ORM):
    id: int
    user_id: int | None
    action: str
    entity_type: str
    entity_id: int | None
    old_data: dict | None
    new_data: dict | None
    created_at: OutDT

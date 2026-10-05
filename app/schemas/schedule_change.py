from datetime import date, time

from pydantic import BaseModel, Field, model_validator

from app.models.enums import ChangeType
from app.schemas.common import ORM, OutDT


class ScheduleChangeCreate(BaseModel):
    """RESCHEDULED needs new_date + new_start_time + new_end_time (room optional).
    ROOM_CHANGED needs new_room_id. TIME_CHANGED needs new_start_time + new_end_time.
    Anything omitted defaults to the original occurrence's value."""
    timetable_slot_id: int
    original_date: date
    change_type: ChangeType
    new_date: date | None = None
    new_start_time: time | None = None
    new_end_time: time | None = None
    new_room_id: int | None = None
    reason: str | None = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def _shape(self):
        t = self.change_type
        if t == ChangeType.CANCELLED:
            raise ValueError("use POST /schedule-changes/cancel-occurrence to cancel a class")
        if t == ChangeType.RESCHEDULED and not (self.new_date and self.new_start_time and self.new_end_time):
            raise ValueError("RESCHEDULED requires new_date, new_start_time and new_end_time")
        if t == ChangeType.ROOM_CHANGED and not self.new_room_id:
            raise ValueError("ROOM_CHANGED requires new_room_id")
        if t == ChangeType.TIME_CHANGED and not (self.new_start_time and self.new_end_time):
            raise ValueError("TIME_CHANGED requires new_start_time and new_end_time")
        if (self.new_start_time is None) != (self.new_end_time is None):
            raise ValueError("provide both new_start_time and new_end_time")
        if self.new_start_time and self.new_end_time and self.new_start_time >= self.new_end_time:
            raise ValueError("new_start_time must be before new_end_time")
        return self


class CancelOccurrence(BaseModel):
    timetable_slot_id: int
    original_date: date
    reason: str | None = Field(default=None, max_length=1000)


class Decision(BaseModel):
    note: str | None = Field(default=None, max_length=1000)


class ScheduleChangeOut(ORM):
    id: int
    timetable_slot_id: int
    original_date: date
    original_room_id: int
    original_start_time: time
    original_end_time: time
    new_date: date | None
    new_room_id: int | None
    new_start_time: time | None
    new_end_time: time | None
    change_type: str
    reason: str | None
    decision_note: str | None
    requested_by: int
    approved_by: int | None
    status: str
    created_at: OutDT
    approved_at: OutDT | None
    rejected_at: OutDT | None

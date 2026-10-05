from datetime import date, time

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM, OutDT


class SlotCreate(BaseModel):
    course_id: int
    faculty_id: int
    room_id: int
    section_id: int
    day_of_week: int = Field(ge=0, le=6, description="0=Monday .. 6=Sunday")
    period_number: int = Field(gt=0)
    start_time: time
    end_time: time
    academic_year: str
    semester: str

    @model_validator(mode="after")
    def _order(self):
        if self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        return self


class SlotUpdate(BaseModel):
    room_id: int | None = None
    faculty_id: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    period_number: int | None = Field(default=None, gt=0)
    is_active: bool | None = None


class SlotOut(ORM):
    id: int
    course_id: int
    faculty_id: int
    room_id: int
    section_id: int
    day_of_week: int
    period_number: int
    start_time: time
    end_time: time
    academic_year: str
    semester: str
    is_active: bool


class OccurrenceOut(BaseModel):
    slot_id: int
    course_code: str
    course_name: str
    faculty_id: int
    section_id: int
    room_id: int
    room: str | None = None
    start: OutDT
    end: OutDT
    source: str
    change_id: int | None = None


class PeriodStatus(BaseModel):
    period_number: int
    start: OutDT
    end: OutDT
    status: str  # CLASS | FREE
    course_code: str | None = None
    room: str | None = None


class FreeInterval(BaseModel):
    start: OutDT
    end: OutDT


class FreePeriodsResponse(BaseModel):
    student_id: int
    date: date
    periods: list[PeriodStatus]
    free_intervals: list[FreeInterval]


class PeriodCreate(BaseModel):
    period_number: int = Field(gt=0)
    start_time: time
    end_time: time
    label: str | None = None


class PeriodOut(ORM):
    id: int
    period_number: int
    start_time: time
    end_time: time
    label: str | None
    is_active: bool


class ImportError_(BaseModel):
    row: int
    field: str | None = None
    code: str
    message: str


class ImportPreview(BaseModel):
    import_id: int
    filename: str
    total_rows: int
    valid_rows: int
    error_count: int
    errors: list[ImportError_]
    can_commit: bool


class ImportCommitResult(BaseModel):
    import_id: int
    inserted: int
    skipped: int
    status: str

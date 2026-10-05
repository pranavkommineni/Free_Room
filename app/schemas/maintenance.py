from pydantic import BaseModel, Field, model_validator

from app.models.enums import MaintenanceStatus
from app.schemas.common import ORM, InDT, OutDT


class MaintenanceCreate(BaseModel):
    room_id: int
    start_datetime: InDT
    end_datetime: InDT
    reason: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def _order(self):
        if self.start_datetime >= self.end_datetime:
            raise ValueError("start_datetime must be before end_datetime")
        return self


class MaintenanceUpdate(BaseModel):
    start_datetime: InDT | None = None
    end_datetime: InDT | None = None
    reason: str | None = Field(default=None, min_length=1, max_length=1000)
    status: MaintenanceStatus | None = None


class MaintenanceOut(ORM):
    id: int
    room_id: int
    start_datetime: OutDT
    end_datetime: OutDT
    reason: str
    reported_by: int
    status: str
    created_at: OutDT


class RestrictionCreate(BaseModel):
    room_id: int
    start_datetime: InDT
    end_datetime: InDT
    reason: str = Field(min_length=1, max_length=1000)

    @model_validator(mode="after")
    def _order(self):
        if self.start_datetime >= self.end_datetime:
            raise ValueError("start_datetime must be before end_datetime")
        return self


class RestrictionOut(ORM):
    id: int
    room_id: int
    start_datetime: OutDT
    end_datetime: OutDT
    reason: str
    created_by: int
    status: str
    created_at: OutDT

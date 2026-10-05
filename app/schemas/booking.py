from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORM, InDT, OutDT


class BookingCreate(BaseModel):
    room_id: int
    start_datetime: InDT
    end_datetime: InDT
    purpose: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _order(self):
        if self.start_datetime >= self.end_datetime:
            raise ValueError("start_datetime must be before end_datetime")
        return self


class BookingOut(ORM):
    id: int
    room_id: int
    user_id: int
    start_datetime: OutDT
    end_datetime: OutDT
    purpose: str | None
    status: str
    created_at: OutDT

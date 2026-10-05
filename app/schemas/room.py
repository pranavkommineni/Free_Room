from pydantic import BaseModel, Field

from app.models.enums import RoomStatus, RoomType
from app.schemas.common import ORM, InDT, OutDT


class BuildingCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=20)


class FloorCreate(BaseModel):
    floor_number: int = Field(ge=0, le=200)


class FloorOut(ORM):
    id: int
    floor_number: int


class BuildingOut(BaseModel):
    id: int
    name: str
    code: str
    floors: list[FloorOut] = []


class RoomCreate(BaseModel):
    floor_id: int
    room_number: str = Field(min_length=1, max_length=20)
    capacity: int = Field(gt=0)
    room_type: RoomType = RoomType.CLASSROOM
    has_ac: bool = False
    has_projector: bool = False
    student_accessible: bool = True
    status: RoomStatus = RoomStatus.ACTIVE


class RoomUpdate(BaseModel):
    room_number: str | None = Field(default=None, min_length=1, max_length=20)
    capacity: int | None = Field(default=None, gt=0)
    room_type: RoomType | None = None
    has_ac: bool | None = None
    has_projector: bool | None = None
    student_accessible: bool | None = None
    status: RoomStatus | None = None


class RoomOut(ORM):
    id: int
    floor_id: int
    building_code: str
    floor_number: int
    room_number: str
    display_name: str
    capacity: int
    room_type: str
    has_ac: bool
    has_projector: bool
    student_accessible: bool
    status: str


# ---- availability -----------------------------------------------------------
class AvailableRoom(BaseModel):
    room_id: int
    room_number: str
    display_name: str
    floor: int
    capacity: int
    has_projector: bool
    has_ac: bool
    available_until: OutDT


class AvailabilityResponse(BaseModel):
    requested_start: OutDT
    requested_end: OutDT
    total_available: int
    rooms: list[AvailableRoom]


class ConflictOut(BaseModel):
    code: str
    message: str
    start: OutDT | None = None
    end: OutDT | None = None
    ref_id: int | None = None


class RoomCheckResponse(BaseModel):
    room_id: int
    available: bool
    conflicts: list[ConflictOut]


class BreakResponse(AvailabilityResponse):
    student_id: int
    student_free: bool
    student_conflicts: list[str] = []


class RecommendedRoom(AvailableRoom):
    score: float
    score_breakdown: dict[str, float]


class RecommendationResponse(BaseModel):
    requested_start: OutDT
    requested_end: OutDT
    weights: dict[str, float]
    rooms: list[RecommendedRoom]

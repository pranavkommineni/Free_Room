from datetime import datetime
from typing import Annotated, Any, Generic, TypeVar

from pydantic import AwareDatetime, BaseModel, ConfigDict, PlainSerializer

from app.utils.datetime_utils import TZ

# Inputs must be timezone-aware (naive datetimes are rejected with 422); outputs are rendered in campus time.
InDT = AwareDatetime
OutDT = Annotated[AwareDatetime, PlainSerializer(lambda d: d.astimezone(TZ).isoformat(), return_type=str, when_used="json")]

T = TypeVar("T")


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


class Message(BaseModel):
    message: str


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: Any | None = None


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail

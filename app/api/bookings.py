from fastapi import APIRouter, Depends, Query, status
from pydantic import AwareDatetime

from app.core.dependencies import CurrentUser, DbSession
from app.schemas.booking import BookingCreate, BookingOut
from app.schemas.common import Page
from app.services.booking_service import BookingService
from app.utils.pagination import PageParams

router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.post("", response_model=BookingOut, status_code=status.HTTP_201_CREATED,
             summary="Book a room",
             description="Runs in a single PostgreSQL transaction: room row lock -> availability re-check -> insert -> "
                         "notification -> audit. Overlaps are also rejected by a database EXCLUDE constraint. Conflicts return 409.")
async def create_booking(data: BookingCreate, user: CurrentUser, session: DbSession):
    return await BookingService(session).create(user, data.room_id, data.start_datetime, data.end_datetime, data.purpose)


@router.get("", response_model=Page[BookingOut], summary="List bookings (students: own only; faculty/admin: all)")
async def list_bookings(user: CurrentUser, session: DbSession, params: PageParams = Depends(), room_id: int | None = None,
                        status: str | None = None, from_datetime: AwareDatetime | None = None, to_datetime: AwareDatetime | None = None,
                        mine: bool = Query(False, description="Faculty/admin: restrict to own bookings")):
    items, total = await BookingService(session).list(user, params, room_id=room_id, status=status, from_dt=from_datetime,
                                                      to_dt=to_datetime, mine=mine)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get("/{booking_id}", response_model=BookingOut)
async def get_booking(booking_id: int, user: CurrentUser, session: DbSession):
    return await BookingService(session).get(user, booking_id)


@router.delete("/{booking_id}", response_model=BookingOut, summary="Cancel a booking (owner or admin) - status becomes CANCELLED")
async def cancel_booking(booking_id: int, user: CurrentUser, session: DbSession):
    return await BookingService(session).cancel(user, booking_id)

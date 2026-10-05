from datetime import timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, RoomNotAvailableError, ValidationAppError
from app.models import RoomBooking, User
from app.models.enums import BookingStatus, NotificationType, Role
from app.repositories.booking_repository import BookingRepository
from app.repositories.room_repository import RoomRepository
from app.services.audit_service import BOOKING_FIELDS, AuditService, snapshot
from app.services.availability_service import AvailabilityService, validate_interval
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import now, to_campus
from app.utils.pagination import PageParams, paginate
from datetime import datetime


class BookingService:
    """Booking transaction:
        1. validate input                       4. availability check (timetable/exceptions/maintenance/
        2. BEGIN; SELECT room FOR UPDATE           restriction/bookings) while holding the room lock
        3. (serialises concurrent attempts      5. INSERT booking + notification + audit, COMMIT
           on the same room)                    6. backstop: PostgreSQL EXCLUDE constraint rejects any overlap
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.bookings = BookingRepository(session)
        self.rooms = RoomRepository(session)
        self.availability = AvailabilityService(session)
        self.notifications = NotificationService(session)
        self.audit = AuditService(session)

    @staticmethod
    def validate_request(start: datetime, end: datetime) -> None:
        validate_interval(start, end)
        minutes = (end - start).total_seconds() / 60
        if minutes < settings.BOOKING_MIN_MINUTES or minutes > settings.BOOKING_MAX_MINUTES:
            raise ValidationAppError(
                f"Booking duration must be between {settings.BOOKING_MIN_MINUTES} and {settings.BOOKING_MAX_MINUTES} minutes.",
                code="INVALID_DURATION")
        if start < now() - timedelta(seconds=60):
            raise ValidationAppError("Bookings cannot start in the past.", code="BOOKING_IN_PAST")
        if start > now() + timedelta(days=settings.BOOKING_MAX_ADVANCE_DAYS):
            raise ValidationAppError(f"Bookings can be made at most {settings.BOOKING_MAX_ADVANCE_DAYS} days ahead.",
                                     code="BOOKING_TOO_FAR_AHEAD")

    async def create(self, user: User, room_id: int, start: datetime, end: datetime, purpose: str | None) -> RoomBooking:
        self.validate_request(start, end)
        room = await self.rooms.get_for_update(room_id)  # lock held until commit/rollback
        if not room:
            raise NotFoundError("Room not found.", code="ROOM_NOT_FOUND")
        await self.availability.assert_available(room, start, end, user)
        booking = RoomBooking(room_id=room.id, user_id=user.id, start_datetime=start, end_datetime=end,
                              purpose=purpose, status=BookingStatus.CONFIRMED.value)
        self.session.add(booking)
        try:
            await self.session.flush()
        except IntegrityError as exc:
            await self.session.rollback()
            if "ex_room_bookings_no_overlap" in str(exc.orig):
                raise RoomNotAvailableError(f"Room {room.display_name} is not available for the requested interval.",
                                            details=[{"code": "BOOKING_CONFLICT", "message": "Overlaps an existing booking."}])
            raise
        self.notifications.notify(user.id, NotificationType.BOOKING_CONFIRMED, "Booking confirmed",
                                  f"{room.display_name} booked {to_campus(start):%d %b %H:%M}-{to_campus(end):%H:%M}.")
        self.audit.record(user.id, "BOOKING_CREATED", "room_booking", booking.id, None, snapshot(booking, BOOKING_FIELDS))
        await self.session.commit()
        return booking

    async def cancel(self, actor: User, booking_id: int) -> RoomBooking:
        b = await self.bookings.get_for_update(booking_id)
        if not b:
            raise NotFoundError("Booking not found.")
        if b.user_id != actor.id and actor.role != Role.ADMIN.value:
            raise ForbiddenError("You can only cancel your own bookings.")
        if b.status not in (BookingStatus.PENDING.value, BookingStatus.CONFIRMED.value):
            raise ConflictError("Booking is not active.", code="BOOKING_NOT_ACTIVE")
        if b.end_datetime <= now():
            raise ConflictError("Past bookings cannot be cancelled.", code="BOOKING_NOT_CANCELLABLE")
        old = snapshot(b, BOOKING_FIELDS)
        b.status = BookingStatus.CANCELLED.value  # history is kept; row is never deleted
        room = await self.rooms.get(b.room_id)
        if b.user_id != actor.id:
            self.notifications.notify(b.user_id, NotificationType.BOOKING_CANCELLED, "Booking cancelled",
                                      f"Your booking of {room.display_name} was cancelled by an administrator.")
        else:
            self.notifications.notify(b.user_id, NotificationType.BOOKING_CANCELLED, "Booking cancelled",
                                      f"You cancelled your booking of {room.display_name}.")
        self.audit.record(actor.id, "BOOKING_CANCELLED", "room_booking", b.id, old, snapshot(b, BOOKING_FIELDS))
        await self.session.commit()
        return b

    async def list(self, actor: User, params: PageParams, *, room_id=None, status=None, from_dt=None, to_dt=None, mine=False):
        uid = actor.id if (actor.role == Role.STUDENT.value or mine) else None
        return await paginate(self.session, self.bookings.list_stmt(user_id=uid, room_id=room_id, status=status,
                                                                    from_dt=from_dt, to_dt=to_dt), params)

    async def get(self, actor: User, booking_id: int) -> RoomBooking:
        b = await self.bookings.get(booking_id)
        if not b or (actor.role == Role.STUDENT.value and b.user_id != actor.id):
            raise NotFoundError("Booking not found.")
        return b

    async def cancel_system(self, actor_id: int, b: RoomBooking, reason: str) -> None:
        """Cancel a booking because the room became unavailable; notifies the owner. Caller owns the transaction."""
        room = await self.rooms.get(b.room_id)
        old = snapshot(b, BOOKING_FIELDS)
        b.status = BookingStatus.CANCELLED.value
        self.notifications.notify(b.user_id, NotificationType.ROOM_UNAVAILABLE, "Booking cancelled - room unavailable",
                                  f"Your booking of {room.display_name} ({to_campus(b.start_datetime):%d %b %H:%M}) was cancelled: {reason}")
        self.audit.record(actor_id, "BOOKING_CANCELLED_BY_SYSTEM", "room_booking", b.id, old, snapshot(b, BOOKING_FIELDS))

    async def release_conflicting(self, actor_id: int, room_id: int, start: datetime, end: datetime, reason: str) -> int:
        """Cancel active bookings overlapping a newly imposed block (maintenance / restriction / deactivation)."""
        victims = await self.bookings.overlapping([room_id], start, end)
        for b in victims:
            await self.cancel_system(actor_id, b, reason)
        return len(victims)

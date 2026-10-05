from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, literal_column, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import BookingStatus, check_in


class RoomBooking(Base, TimestampMixin):
    __tablename__ = "room_bookings"
    __table_args__ = (
        CheckConstraint("start_datetime < end_datetime", name="interval_valid"),
        CheckConstraint(check_in("status", BookingStatus), name="status_valid"),
        # Hard guarantee against double booking: no two PENDING/CONFIRMED bookings of the same room
        # may have overlapping [start, end) ranges. Enforced by PostgreSQL itself (GiST index).
        ExcludeConstraint(
            ("room_id", "="),
            (literal_column("tstzrange(start_datetime, end_datetime, '[)')"), "&&"),
            name="ex_room_bookings_no_overlap",
            using="gist",
            where=text("status IN ('PENDING','CONFIRMED')"),
        ),
        Index("ix_room_bookings_room_id", "room_id"),
        Index("ix_room_bookings_start_datetime", "start_datetime"),
        Index("ix_room_bookings_user_id", "user_id"),
        Index("ix_room_bookings_status", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    purpose: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default=BookingStatus.CONFIRMED.value)

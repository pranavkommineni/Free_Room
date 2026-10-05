from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import RestrictionStatus, check_in


class RoomRestriction(Base):
    __tablename__ = "room_restrictions"
    __table_args__ = (
        CheckConstraint("start_datetime < end_datetime", name="interval_valid"),
        CheckConstraint(check_in("status", RestrictionStatus), name="status_valid"),
        Index("ix_room_restrictions_room_id", "room_id"),
        Index("ix_room_restrictions_start_datetime", "start_datetime"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"))
    start_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_datetime: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reason: Mapped[str] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(16), default=RestrictionStatus.ACTIVE.value)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

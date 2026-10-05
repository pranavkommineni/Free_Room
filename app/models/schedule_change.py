from datetime import date, datetime, time

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, String, Text, Time, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.enums import ChangeStatus, ChangeType, check_in
from app.models.timetable import TimetableSlot


class ScheduleChange(Base):
    """One-off exception to the recurring timetable (reschedule / cancel / room or time change).
    The effective schedule = regular slots + APPROVED changes - cancelled occurrences."""
    __tablename__ = "schedule_changes"
    __table_args__ = (
        CheckConstraint(check_in("change_type", ChangeType), name="type_valid"),
        CheckConstraint(check_in("status", ChangeStatus), name="status_valid"),
        CheckConstraint("original_start_time < original_end_time", name="original_time_order"),
        CheckConstraint("new_start_time IS NULL OR new_end_time IS NULL OR new_start_time < new_end_time", name="new_time_order"),
        CheckConstraint(
            "change_type = 'CANCELLED' OR (new_date IS NOT NULL AND new_room_id IS NOT NULL "
            "AND new_start_time IS NOT NULL AND new_end_time IS NOT NULL)",
            name="new_fields_present",
        ),
        Index("ix_schedule_changes_timetable_slot_id", "timetable_slot_id"),
        Index("ix_schedule_changes_status", "status"),
        Index("ix_schedule_changes_original_date", "original_date"),
        Index("ix_schedule_changes_new_date", "new_date"),
        # one open (pending/approved) exception per occurrence
        Index(
            "uq_schedule_changes_open_occurrence", "timetable_slot_id", "original_date",
            unique=True, postgresql_where=text("status IN ('PENDING','APPROVED')"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    timetable_slot_id: Mapped[int] = mapped_column(ForeignKey("timetable_slots.id", ondelete="RESTRICT"))

    original_date: Mapped[date] = mapped_column(Date)
    original_room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"))
    original_start_time: Mapped[time] = mapped_column(Time)
    original_end_time: Mapped[time] = mapped_column(Time)

    new_date: Mapped[date | None] = mapped_column(Date)
    new_room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"))
    new_start_time: Mapped[time | None] = mapped_column(Time)
    new_end_time: Mapped[time | None] = mapped_column(Time)

    change_type: Mapped[str] = mapped_column(String(20))
    reason: Mapped[str | None] = mapped_column(Text)
    decision_note: Mapped[str | None] = mapped_column(Text)

    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[str] = mapped_column(String(16), default=ChangeStatus.PENDING.value)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    slot: Mapped[TimetableSlot] = relationship(lazy="joined")

from datetime import time

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, SmallInteger, String, Time, text, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.course import Course


class TimetableSlot(Base, TimestampMixin):
    """Recurring weekly timetable entry. NEVER mutated for one-off changes (see ScheduleChange)."""
    __tablename__ = "timetable_slots"
    __table_args__ = (
        CheckConstraint("day_of_week BETWEEN 0 AND 6", name="day_valid"),
        CheckConstraint("start_time < end_time", name="time_order"),
        CheckConstraint("period_number > 0", name="period_valid"),
        Index("ix_timetable_slots_room_id", "room_id"),
        Index("ix_timetable_slots_faculty_id", "faculty_id"),
        Index("ix_timetable_slots_section_id", "section_id"),
        Index("ix_timetable_slots_day_of_week", "day_of_week"),
        Index(
            "uq_timetable_slots_room_time_active",
            "room_id", "day_of_week", "start_time", "academic_year", "semester",
            unique=True, postgresql_where=text("is_active"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id", ondelete="RESTRICT"))
    faculty_id: Mapped[int] = mapped_column(ForeignKey("faculty.id", ondelete="RESTRICT"))
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id", ondelete="RESTRICT"))
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="RESTRICT"))
    day_of_week: Mapped[int] = mapped_column(SmallInteger)  # 0=Monday .. 6=Sunday
    period_number: Mapped[int] = mapped_column(SmallInteger)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    academic_year: Mapped[str] = mapped_column(String(12))
    semester: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

    course: Mapped[Course] = relationship(lazy="joined")

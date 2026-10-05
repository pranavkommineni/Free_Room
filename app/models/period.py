from datetime import time

from sqlalchemy import Boolean, CheckConstraint, SmallInteger, String, Time, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class AcademicPeriod(Base):
    """Configurable period grid (period number -> wall-clock boundaries). Edit rows to change the grid."""
    __tablename__ = "academic_periods"
    __table_args__ = (CheckConstraint("start_time < end_time", name="time_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    period_number: Mapped[int] = mapped_column(SmallInteger, unique=True)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    label: Mapped[str | None] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

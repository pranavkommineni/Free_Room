from sqlalchemy import Boolean, CheckConstraint, SmallInteger, String, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (CheckConstraint("credits >= 0", name="credits_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    course_code: Mapped[str] = mapped_column(String(30), unique=True)
    course_name: Mapped[str] = mapped_column(String(200))
    department: Mapped[str] = mapped_column(String(80))
    credits: Mapped[int] = mapped_column(SmallInteger, default=3)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (CheckConstraint("year BETWEEN 1 AND 8", name="year_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    student_roll_no: Mapped[str] = mapped_column(String(30), unique=True)
    department: Mapped[str] = mapped_column(String(80))
    year: Mapped[int] = mapped_column(SmallInteger)
    section_id: Mapped[int | None] = mapped_column(ForeignKey("sections.id", ondelete="SET NULL"), index=True)

    user: Mapped[User] = relationship(lazy="joined")

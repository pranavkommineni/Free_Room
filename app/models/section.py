from sqlalchemy import CheckConstraint, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Section(Base):
    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint("code", "academic_year", "semester", name="uq_sections_code_term"),
        UniqueConstraint("department", "year", "section_name", "academic_year", "semester", name="uq_sections_identity"),
        CheckConstraint("year BETWEEN 1 AND 8", name="year_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(40))  # short unique label used by CSV import, e.g. "CSE-2-A"
    department: Mapped[str] = mapped_column(String(80))
    year: Mapped[int] = mapped_column(SmallInteger)
    section_name: Mapped[str] = mapped_column(String(20))
    academic_year: Mapped[str] = mapped_column(String(12))  # e.g. "2026-27"
    semester: Mapped[str] = mapped_column(String(20))

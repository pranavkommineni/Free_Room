from datetime import datetime
from typing import Any

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import ImportStatus, check_in


class TimetableImport(Base):
    """Staged CSV upload: preview -> (admin confirms) -> commit."""
    __tablename__ = "timetable_imports"
    __table_args__ = (CheckConstraint(check_in("status", ImportStatus), name="status_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"))
    filename: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(16), default=ImportStatus.PENDING.value)
    total_rows: Mapped[int] = mapped_column(default=0)
    raw_rows: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    errors: Mapped[list[dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

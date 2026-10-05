from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class Building(Base):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(20), unique=True)  # e.g. "AB3"

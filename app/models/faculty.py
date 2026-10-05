from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User


class Faculty(Base):
    __tablename__ = "faculty"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    faculty_code: Mapped[str] = mapped_column(String(30), unique=True)
    department: Mapped[str] = mapped_column(String(80))

    user: Mapped[User] = relationship(lazy="joined")

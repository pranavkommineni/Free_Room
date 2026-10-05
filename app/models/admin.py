from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User


class Admin(Base):
    __tablename__ = "admins"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    designation: Mapped[str | None] = mapped_column(String(120))

    user: Mapped[User] = relationship(lazy="joined")

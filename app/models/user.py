from sqlalchemy import Boolean, CheckConstraint, String, false, true
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin
from app.models.enums import Role, check_in


class User(Base, TimestampMixin):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint(check_in("role", Role), name="role_valid"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)  # stored lower-cased
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

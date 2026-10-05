from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base
from app.models.enums import NotificationType, check_in


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(check_in("type", NotificationType), name="type_valid"),
        Index("ix_notifications_user_id", "user_id"),
        Index("ix_notifications_user_unread", "user_id", "is_read"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text)
    type: Mapped[str] = mapped_column(String(32))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

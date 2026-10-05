from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models import Notification
from app.models.enums import NotificationType
from app.utils.pagination import PageParams, paginate


class NotificationService:
    """notify()/notify_many() only add rows to the session - the caller's transaction commits them
    together with the business change (atomic: no notification without the change, and vice versa)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def notify(self, user_id: int, type_: NotificationType, title: str, message: str) -> None:
        self.session.add(Notification(user_id=user_id, type=type_.value, title=title, message=message))

    def notify_many(self, user_ids: list[int], type_: NotificationType, title: str, message: str) -> None:
        for uid in set(user_ids):
            self.notify(uid, type_, title, message)

    async def list_for_user(self, user_id: int, params: PageParams, unread_only: bool = False):
        stmt = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            stmt = stmt.where(Notification.is_read.is_(False))
        return await paginate(self.session, stmt.order_by(Notification.created_at.desc(), Notification.id.desc()), params)

    async def unread_count(self, user_id: int) -> int:
        stmt = select(func.count()).select_from(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False))
        return (await self.session.execute(stmt)).scalar_one()

    async def mark_read(self, user_id: int, notification_id: int) -> Notification:
        n = await self.session.get(Notification, notification_id)
        if not n or n.user_id != user_id:
            raise NotFoundError("Notification not found.")
        n.is_read = True
        await self.session.commit()
        return n

    async def mark_all_read(self, user_id: int) -> int:
        res = await self.session.execute(
            update(Notification).where(Notification.user_id == user_id, Notification.is_read.is_(False)).values(is_read=True)
        )
        await self.session.commit()
        return res.rowcount or 0

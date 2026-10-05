from fastapi import APIRouter, Depends

from app.core.dependencies import CurrentUser, DbSession
from app.schemas.common import Message, Page
from app.schemas.notification import NotificationOut
from app.services.notification_service import NotificationService
from app.utils.pagination import PageParams

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=Page[NotificationOut], summary="My notifications")
async def list_notifications(user: CurrentUser, session: DbSession, params: PageParams = Depends(), unread_only: bool = False):
    items, total = await NotificationService(session).list_for_user(user.id, params, unread_only)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get("/unread-count", response_model=dict[str, int])
async def unread_count(user: CurrentUser, session: DbSession):
    return {"unread": await NotificationService(session).unread_count(user.id)}


@router.put("/read-all", response_model=Message)
async def read_all(user: CurrentUser, session: DbSession):
    n = await NotificationService(session).mark_all_read(user.id)
    return Message(message=f"{n} notification(s) marked as read.")


@router.put("/{notification_id}/read", response_model=NotificationOut)
async def read_one(notification_id: int, user: CurrentUser, session: DbSession):
    return await NotificationService(session).mark_read(user.id, notification_id)

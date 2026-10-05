from fastapi import APIRouter, Query, status
from sqlalchemy import select

from app.core.dependencies import AdminUser, DbSession
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models import User
from app.schemas.common import Page
from app.schemas.user import AdminUserCreate, UserOut, UserUpdate
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.utils.pagination import PageParams, paginate
from fastapi import Depends

router = APIRouter(prefix="/users", tags=["Users (admin)"])


@router.get("", response_model=Page[UserOut], summary="List users (ADMIN)")
async def list_users(admin: AdminUser, session: DbSession, params: PageParams = Depends(), role: str | None = Query(None),
                     is_active: bool | None = None):
    stmt = select(User)
    if role:
        stmt = stmt.where(User.role == role.upper())
    if is_active is not None:
        stmt = stmt.where(User.is_active.is_(is_active))
    items, total = await paginate(session, stmt.order_by(User.id), params)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED, summary="Create a user with any role (ADMIN)")
async def create_user(data: AdminUserCreate, admin: AdminUser, session: DbSession):
    return await AuthService(session).admin_create_user(admin, data)


@router.put("/{user_id}", response_model=UserOut, summary="Update name / activate / deactivate (ADMIN)")
async def update_user(user_id: int, data: UserUpdate, admin: AdminUser, session: DbSession):
    user = await session.get(User, user_id)
    if not user:
        raise NotFoundError("User not found.")
    if user.id == admin.id and data.is_active is False:
        raise ForbiddenError("You cannot deactivate your own account.", code="SELF_DEACTIVATION")
    old = {"name": user.name, "is_active": user.is_active}
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(user, k, v)
    AuditService(session).record(admin.id, "USER_UPDATED", "user", user.id, old, {"name": user.name, "is_active": user.is_active})
    await session.commit()
    return user

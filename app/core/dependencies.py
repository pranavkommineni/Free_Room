from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.security import decode_access_token
from app.models import User
from app.models.enums import Role
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False, description="JWT obtained from `POST /api/v1/auth/login`.")

DbSession = Annotated[AsyncSession, Depends(get_session)]


async def get_token_payload(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]) -> dict:
    if creds is None:
        raise UnauthorizedError("Authentication required.", code="NOT_AUTHENTICATED")
    return decode_access_token(creds.credentials)


async def get_current_user(payload: Annotated[dict, Depends(get_token_payload)], session: DbSession) -> User:
    repo = UserRepository(session)
    if await repo.is_revoked(payload["jti"]):
        raise UnauthorizedError("Token has been revoked.", code="TOKEN_REVOKED")
    user = await repo.get(int(payload["sub"]))
    if not user or not user.is_active:
        raise UnauthorizedError("User not found or disabled.", code="INVALID_TOKEN")
    return user  # role is read from the DB, never trusted from the token


def require_roles(*roles: Role):
    allowed = {r.value for r in roles}

    async def _dep(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in allowed:
            raise ForbiddenError("You do not have permission to perform this action.", code="INSUFFICIENT_ROLE")
        return user

    return _dep


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_roles(Role.ADMIN))]
FacultyUser = Annotated[User, Depends(require_roles(Role.FACULTY))]
FacultyOrAdmin = Annotated[User, Depends(require_roles(Role.FACULTY, Role.ADMIN))]
StudentOrAdmin = Annotated[User, Depends(require_roles(Role.STUDENT, Role.ADMIN))]
FacultyAdminOrStudent = CurrentUser

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dependencies import CurrentUser, DbSession, get_token_payload
from app.core.rate_limit import auth_rate_limit
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse
from app.schemas.common import Message
from app.schemas.user import UserOut
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(auth_rate_limit)],
             summary="Register a student account",
             description="Self-registration always creates a **STUDENT**. A `role` field is rejected (422). "
                         "Faculty/admin accounts are created by an admin via `POST /users`.")
async def register(data: RegisterRequest, session: DbSession):
    return await AuthService(session).register_student(data)


@router.post("/login", response_model=TokenResponse, dependencies=[Depends(auth_rate_limit)], summary="Log in and obtain a JWT")
async def login(data: LoginRequest, session: DbSession):
    return await AuthService(session).login(data)


@router.get("/me", response_model=MeResponse, summary="Current user profile")
async def me(user: CurrentUser, session: DbSession):
    return await AuthService(session).me(user)


@router.post("/logout", response_model=Message, summary="Revoke the current token")
async def logout(user: CurrentUser, payload: Annotated[dict, Depends(get_token_payload)], session: DbSession):
    await AuthService(session).logout(payload)
    return Message(message="Logged out.")

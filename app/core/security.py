import uuid
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import settings
from app.core.exceptions import UnauthorizedError

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: int, role: str, expires_delta: timedelta | None = None) -> tuple[str, datetime]:
    exp = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    payload = {"sub": str(user_id), "role": role, "jti": uuid.uuid4().hex, "iat": datetime.now(timezone.utc), "exp": exp}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM), exp


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"require": ["exp", "sub", "jti"]})
    except jwt.ExpiredSignatureError:
        raise UnauthorizedError("Token has expired.", code="TOKEN_EXPIRED")
    except jwt.PyJWTError:
        raise UnauthorizedError("Invalid authentication token.", code="INVALID_TOKEN")

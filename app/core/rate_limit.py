"""Minimal in-process sliding-window rate limiter for auth endpoints.
Per-process only; swap `_hits` for Redis (INCR + EXPIRE) when running several workers."""
import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import settings
from app.core.exceptions import TooManyRequestsError

_hits: dict[str, deque[float]] = defaultdict(deque)


async def auth_rate_limit(request: Request) -> None:
    if not settings.RATE_LIMIT_ENABLED:
        return
    key = f"{request.client.host if request.client else 'unknown'}:{request.url.path}"
    now, window = time.monotonic(), 60.0
    q = _hits[key]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= settings.RATE_LIMIT_PER_MINUTE:
        raise TooManyRequestsError("Too many requests. Please retry later.")
    q.append(now)

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings

_kwargs: dict = {"pool_pre_ping": True}
if settings.ENVIRONMENT == "test":
    _kwargs["poolclass"] = NullPool  # fresh connection per session -> real concurrency in tests
else:
    _kwargs.update(pool_size=10, max_overflow=20)

engine = create_async_engine(settings.DATABASE_URL, **_kwargs)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise

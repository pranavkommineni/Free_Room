from typing import Any

from fastapi import Query
from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession


class PageParams:
    def __init__(self, page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100)) -> None:
        self.page = page
        self.page_size = page_size

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


async def paginate(session: AsyncSession, stmt: Select, params: PageParams) -> tuple[list[Any], int]:
    total = (await session.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar_one()
    rows = (await session.execute(stmt.offset(params.offset).limit(params.page_size))).scalars().unique().all()
    return list(rows), total

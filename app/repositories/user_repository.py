from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Admin, Faculty, RevokedToken, Student, User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: int) -> User | None:
        return await self.session.get(User, user_id)

    async def get_by_email(self, email: str) -> User | None:
        return (await self.session.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none()

    async def student_by_user(self, user_id: int) -> Student | None:
        return (await self.session.execute(select(Student).where(Student.user_id == user_id))).scalar_one_or_none()

    async def student(self, student_id: int) -> Student | None:
        return (await self.session.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()

    async def faculty_by_user(self, user_id: int) -> Faculty | None:
        return (await self.session.execute(select(Faculty).where(Faculty.user_id == user_id))).scalar_one_or_none()

    async def faculty(self, faculty_id: int) -> Faculty | None:
        return (await self.session.execute(select(Faculty).where(Faculty.id == faculty_id))).scalar_one_or_none()

    async def admin_user_ids(self) -> list[int]:
        rows = await self.session.execute(select(User.id).where(User.role == "ADMIN", User.is_active.is_(True)))
        return list(rows.scalars())

    async def student_user_ids_in_section(self, section_id: int) -> list[int]:
        rows = await self.session.execute(
            select(Student.user_id).join(User, User.id == Student.user_id).where(Student.section_id == section_id, User.is_active.is_(True))
        )
        return list(rows.scalars())

    async def is_revoked(self, jti: str) -> bool:
        return (await self.session.get(RevokedToken, jti)) is not None

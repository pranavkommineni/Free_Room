from datetime import datetime, timezone

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, UnauthorizedError
from app.core.security import create_access_token, hash_password, verify_password
from app.models import Admin, Faculty, RevokedToken, Section, Student, User
from app.models.enums import Role
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, MeResponse, RegisterRequest, TokenResponse
from app.schemas.user import AdminUserCreate
from app.services.audit_service import AuditService

_DUMMY_HASH = hash_password("timing-equaliser-password")  # verify against this when the email is unknown


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)

    async def _create(self, *, name: str, email: str, password: str, role: Role, department: str | None = None,
                      student_roll_no: str | None = None, year: int | None = None, section_id: int | None = None,
                      faculty_code: str | None = None, designation: str | None = None) -> User:
        if await self.users.get_by_email(email):
            raise ConflictError("Email is already registered.", code="EMAIL_ALREADY_REGISTERED")
        if section_id is not None and not await self.session.get(Section, section_id):
            raise NotFoundError("Section not found.", code="SECTION_NOT_FOUND")
        user = User(name=name.strip(), email=email.lower(), password_hash=hash_password(password), role=role.value)
        self.session.add(user)
        await self.session.flush()
        if role == Role.STUDENT:
            self.session.add(Student(user_id=user.id, student_roll_no=student_roll_no, department=department, year=year, section_id=section_id))
        elif role == Role.FACULTY:
            self.session.add(Faculty(user_id=user.id, faculty_code=faculty_code, department=department))
        else:
            self.session.add(Admin(user_id=user.id, designation=designation))
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("Roll number / faculty code or email already exists.", code="DUPLICATE_IDENTITY")
        return user

    async def register_student(self, data: RegisterRequest) -> User:
        user = await self._create(name=data.name, email=data.email, password=data.password, role=Role.STUDENT,
                                  department=data.department, student_roll_no=data.student_roll_no, year=data.year,
                                  section_id=data.section_id)
        await self.session.commit()
        return user

    async def admin_create_user(self, actor: User, data: AdminUserCreate) -> User:
        user = await self._create(**data.model_dump(exclude={"role"}), role=data.role)
        AuditService(self.session).record(actor.id, "USER_CREATED", "user", user.id, None, {"email": user.email, "role": user.role})
        await self.session.commit()
        return user

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self.users.get_by_email(data.email)
        ok = verify_password(data.password, user.password_hash if user else _DUMMY_HASH)
        if not user or not ok:
            raise UnauthorizedError("Invalid email or password.", code="INVALID_CREDENTIALS")
        if not user.is_active:
            raise ForbiddenError("Account is disabled.", code="ACCOUNT_DISABLED")
        token, exp = create_access_token(user.id, user.role)
        return TokenResponse(access_token=token, expires_at=exp)

    async def me(self, user: User) -> MeResponse:
        resp = MeResponse(id=user.id, name=user.name, email=user.email, role=user.role, is_active=user.is_active)
        if user.role == Role.STUDENT.value and (s := await self.users.student_by_user(user.id)):
            resp.student_id, resp.student_roll_no, resp.section_id = s.id, s.student_roll_no, s.section_id
        elif user.role == Role.FACULTY.value and (f := await self.users.faculty_by_user(user.id)):
            resp.faculty_id, resp.faculty_code = f.id, f.faculty_code
        return resp

    async def logout(self, payload: dict) -> None:
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await self.session.execute(delete(RevokedToken).where(RevokedToken.expires_at < datetime.now(timezone.utc)))
        if not await self.session.get(RevokedToken, payload["jti"]):
            self.session.add(RevokedToken(jti=payload["jti"], expires_at=exp))
        await self.session.commit()

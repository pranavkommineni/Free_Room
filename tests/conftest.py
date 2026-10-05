"""Test harness. Runs against a REAL PostgreSQL database (default: freeroom_test) built by `alembic upgrade head`,
so migrations, CHECK constraints and the EXCLUDE constraint are exercised exactly as in production.
Override with TEST_DATABASE_URL."""
import os
import subprocess
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path
from types import SimpleNamespace

TEST_DB = os.environ.get("TEST_DATABASE_URL", "postgresql+asyncpg://freeroom:freeroom@localhost:5432/freeroom_test")
os.environ.update(DATABASE_URL=TEST_DB, ENVIRONMENT="test", RATE_LIMIT_ENABLED="false",
                  JWT_SECRET="test-secret-test-secret-test-secret-1234")

import httpx  # noqa: E402
import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.core.database import SessionLocal, engine  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (Admin, Building, Course, Faculty, Floor, Room, Section, Student, TimetableSlot, User, AcademicPeriod)  # noqa: E402
from app.utils.datetime_utils import TZ, combine, now  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
PASSWORD = "CorrectHorse-Battery9"
_PW_HASH = hash_password(PASSWORD)  # hash once: argon2 is deliberately slow


@pytest.fixture(scope="session", autouse=True)
def _migrated_database():
    env = {**os.environ}
    for cmd in (["downgrade", "base"], ["upgrade", "head"]):
        r = subprocess.run([sys.executable, "-m", "alembic", *cmd], cwd=ROOT, env=env, capture_output=True, text=True)
        assert r.returncode == 0, r.stderr


@pytest_asyncio.fixture(autouse=True)
async def clean_db(_migrated_database):
    async with engine.begin() as conn:
        tables = (await conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> 'alembic_version'"))).scalars().all()
        await conn.execute(text("TRUNCATE " + ", ".join(tables) + " RESTART IDENTITY CASCADE"))
    yield


@pytest_asyncio.fixture
async def client():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as c:
        yield c


def at(d: date, hhmm: str) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return combine(d, time(h, m))


def iso(dt: datetime) -> str:
    return dt.astimezone(TZ).isoformat()


def auth(user: User) -> dict[str, str]:
    token, _ = create_access_token(user.id, user.role)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture
async def world(clean_db):
    """Building T1 (2 floors, rooms R101/R102/R201), admin, 2 faculty, 2 students in section CSE-2-A, course, 4 periods."""
    async with SessionLocal() as s:
        b = Building(name="Test Block", code="T1")
        s.add(b)
        await s.flush()
        f1, f2 = Floor(building_id=b.id, floor_number=1), Floor(building_id=b.id, floor_number=2)
        s.add_all([f1, f2])
        await s.flush()
        rooms = [Room(floor_id=f1.id, room_number="R101", capacity=70, has_projector=True),
                 Room(floor_id=f1.id, room_number="R102", capacity=70, has_projector=True),
                 Room(floor_id=f2.id, room_number="R201", capacity=40, has_projector=False, has_ac=True)]
        s.add_all(rooms)

        def mk(name, email, role):
            u = User(name=name, email=email, password_hash=_PW_HASH, role=role)
            s.add(u)
            return u
        admin_u, fac_u, fac2_u, stu_u, stu2_u = (mk("Admin", "admin@example.com", "ADMIN"), mk("Prof One", "fac1@example.com", "FACULTY"),
                                                  mk("Prof Two", "fac2@example.com", "FACULTY"), mk("Stu One", "stu1@example.com", "STUDENT"),
                                                  mk("Stu Two", "stu2@example.com", "STUDENT"))
        await s.flush()
        sec = Section(code="CSE-2-A", department="CSE", year=2, section_name="A", academic_year="2026-27", semester="WINTER")
        sec2 = Section(code="CSE-2-B", department="CSE", year=2, section_name="B", academic_year="2026-27", semester="WINTER")
        s.add_all([sec, sec2])
        await s.flush()
        s.add(Admin(user_id=admin_u.id))
        fac, fac2 = Faculty(user_id=fac_u.id, faculty_code="F001", department="CSE"), Faculty(user_id=fac2_u.id, faculty_code="F002", department="CSE")
        stu = Student(user_id=stu_u.id, student_roll_no="21AAA0001", department="CSE", year=2, section_id=sec.id)
        stu2 = Student(user_id=stu2_u.id, student_roll_no="21AAA0002", department="CSE", year=2, section_id=sec.id)
        course = Course(course_code="CSE101", course_name="Databases", department="CSE", credits=3)
        course2 = Course(course_code="CSE102", course_name="Networks", department="CSE", credits=3)
        s.add_all([fac, fac2, stu, stu2, course, course2])
        for i, (a, z) in enumerate([("08:00", "08:50"), ("08:50", "09:40"), ("09:40", "10:30"), ("10:30", "11:20")], start=1):
            s.add(AcademicPeriod(period_number=i, start_time=time.fromisoformat(a), end_time=time.fromisoformat(z), label=f"P{i}"))
        await s.commit()
        for o in (b, f1, f2, *rooms, admin_u, fac_u, fac2_u, stu_u, stu2_u, sec, sec2, fac, fac2, stu, stu2, course, course2):
            await s.refresh(o)
    return SimpleNamespace(
        building=b, floor1=f1, floor2=f2, r101=rooms[0], r102=rooms[1], r201=rooms[2], admin=admin_u, fac_user=fac_u,
        fac2_user=fac2_u, stu_user=stu_u, stu2_user=stu2_u, section=sec, section2=sec2, fac=fac, fac2=fac2, stu=stu, stu2=stu2,
        course=course, course2=course2, class_date=now().date() + timedelta(days=3), free_date=now().date() + timedelta(days=4))


@pytest_asyncio.fixture
async def slot(world):
    """Recurring class: CSE101, fac1, section A, room R101, 10:00-10:50 on world.class_date's weekday."""
    async with SessionLocal() as s:
        sl = TimetableSlot(course_id=world.course.id, faculty_id=world.fac.id, room_id=world.r101.id, section_id=world.section.id,
                           day_of_week=world.class_date.weekday(), period_number=3, start_time=time(10, 0), end_time=time(10, 50),
                           academic_year="2026-27", semester="WINTER")
        s.add(sl)
        await s.commit()
        await s.refresh(sl)
    return sl


async def post_booking(client, user, room, start: datetime, end: datetime, purpose="study"):
    return await client.post("/api/v1/bookings", headers=auth(user), json={
        "room_id": room.id, "start_datetime": iso(start), "end_datetime": iso(end), "purpose": purpose})


async def availability(client, user, start: datetime, end: datetime, **params):
    r = await client.get("/api/v1/availability", headers=auth(user), params={"start_datetime": iso(start), "end_datetime": iso(end), **params})
    assert r.status_code == 200, r.text
    return {x["display_name"] for x in r.json()["rooms"]}, r.json()

import csv
from datetime import time, timedelta
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models import (AcademicPeriod, Admin, Building, Course, Faculty, Floor, Notification, Room, RoomBooking, RoomMaintenance,
                        Section, Student, TimetableSlot, User)
from app.seed import sample_data as sd
from app.utils.datetime_utils import combine, now

AB3_FLOORS, AB3_ROOMS_PER_FLOOR = 7, 11
DEFAULT_ROOMS_FILE = Path(__file__).with_name("ab3_rooms.csv")


class SeedError(Exception):
    pass


def read_room_numbers(path: Path) -> dict[int, list[str]]:
    """Parse 'floor_number,room_number' rows (ignores blank lines and '#' comments)."""
    rows: dict[int, list[str]] = {}
    with open(path, newline="", encoding="utf-8-sig") as fh:
        lines = [ln for ln in fh if ln.strip() and not ln.lstrip().startswith("#")]
    for r in csv.DictReader(lines):
        try:
            floor = int(r["floor_number"])
        except (KeyError, ValueError):
            raise SeedError(f"Bad floor_number in rooms file: {r}")
        number = (r.get("room_number") or "").strip()
        if not number:
            raise SeedError(f"Empty room_number: {r}")
        rows.setdefault(floor, []).append(number)
    return rows


def validate_ab3(rows: dict[int, list[str]], allow_partial: bool) -> None:
    flat = [n for ns in rows.values() for n in ns]
    if len(flat) != len(set(flat)):
        raise SeedError("Duplicate room numbers in rooms file (numbers must be unique within the building).")
    bad_floors = [f for f in rows if not 1 <= f <= AB3_FLOORS]
    if bad_floors:
        raise SeedError(f"Floors outside 1..{AB3_FLOORS}: {bad_floors}")
    if not allow_partial:
        wrong = {f: len(rows.get(f, [])) for f in range(1, AB3_FLOORS + 1) if len(rows.get(f, [])) != AB3_ROOMS_PER_FLOOR}
        if wrong:
            raise SeedError(f"AB3 needs exactly {AB3_ROOMS_PER_FLOOR} rooms on each of {AB3_FLOORS} floors (77 total). "
                            f"Wrong counts per floor: {wrong}. Use --allow-partial to override.")


async def seed_periods(s: AsyncSession) -> int:
    if (await s.execute(select(func.count()).select_from(AcademicPeriod))).scalar_one():
        return 0
    for n, a, z in sd.DEFAULT_PERIODS:
        s.add(AcademicPeriod(period_number=n, start_time=time.fromisoformat(a), end_time=time.fromisoformat(z), label=f"Period {n}"))
    return len(sd.DEFAULT_PERIODS)


async def _building(s: AsyncSession, name: str, code: str, floors: list[int]) -> dict[int, Floor]:
    b = (await s.execute(select(Building).where(Building.code == code))).scalar_one_or_none()
    if not b:
        b = Building(name=name, code=code)
        s.add(b)
        await s.flush()
    existing = {f.floor_number: f for f in (await s.execute(select(Floor).where(Floor.building_id == b.id))).scalars().unique()}
    for n in floors:
        if n not in existing:
            existing[n] = Floor(building_id=b.id, floor_number=n)
            s.add(existing[n])
    await s.flush()
    return existing


async def seed_ab3(s: AsyncSession, rooms_file: Path | None = None, allow_partial: bool = False) -> tuple[int, str]:
    """Building AB3 + floors 1-7 always; rooms only when real numbers are supplied. Idempotent."""
    floors = await _building(s, "Academic Block 3", "AB3", list(range(1, AB3_FLOORS + 1)))
    rows = read_room_numbers(rooms_file or DEFAULT_ROOMS_FILE)
    if not rows:
        return 0, "AB3 building and 7 floors created. No room numbers supplied -> 0 rooms (fill app/seed/ab3_rooms.csv or pass --rooms-file)."
    validate_ab3(rows, allow_partial)
    have = {r.room_number for r in (await s.execute(select(Room).join(Floor).join(Building).where(Building.code == "AB3"))).scalars().unique()}
    added = 0
    for floor_no, numbers in rows.items():
        for num in numbers:
            if num not in have:
                s.add(Room(floor_id=floors[floor_no].id, room_number=num, capacity=70, room_type="CLASSROOM", has_ac=False,
                           has_projector=True, student_accessible=True, status="ACTIVE"))
                added += 1
    return added, f"AB3: {added} room(s) added."


async def ensure_admin(s: AsyncSession, email: str, password: str, name: str = "Administrator") -> bool:
    if (await s.execute(select(User).where(User.email == email.lower()))).scalar_one_or_none():
        return False
    u = User(name=name, email=email.lower(), password_hash=hash_password(password), role="ADMIN")
    s.add(u)
    await s.flush()
    s.add(Admin(user_id=u.id, designation="System administrator"))
    return True


async def seed_demo(s: AsyncSession, password: str) -> str:
    if (await s.execute(select(User).where(User.email == sd.DEMO_ADMIN[1]))).scalar_one_or_none():
        return "Demo data already present - skipped."
    floors = await _building(s, sd.DEMO_BUILDING["name"], sd.DEMO_BUILDING["code"], sd.DEMO_FLOORS)
    rooms = []
    for fl, nums in sd.DEMO_ROOMS.items():
        for n in nums:
            r = Room(floor_id=floors[fl].id, room_number=n, capacity=70, has_projector=True)
            s.add(r)
            rooms.append(r)
    pw = hash_password(password)
    admin = User(name=sd.DEMO_ADMIN[0], email=sd.DEMO_ADMIN[1], password_hash=pw, role="ADMIN")
    facs_u = [User(name=n, email=e, password_hash=pw, role="FACULTY") for n, e, _ in sd.DEMO_FACULTY]
    stus_u = [User(name=n, email=e, password_hash=pw, role="STUDENT") for n, e, _ in sd.DEMO_STUDENTS]
    s.add_all([admin, *facs_u, *stus_u])
    sec = Section(**sd.DEMO_SECTION)
    courses = [Course(course_code=c, course_name=n, department="CSE", credits=3) for c, n in sd.DEMO_COURSES]
    s.add_all([sec, *courses])
    await s.flush()
    s.add(Admin(user_id=admin.id, designation="Demo admin"))
    facs = [Faculty(user_id=u.id, faculty_code=code, department="CSE") for u, (_, _, code) in zip(facs_u, sd.DEMO_FACULTY)]
    s.add_all(facs)
    s.add_all([Student(user_id=u.id, student_roll_no=roll, department="CSE", year=2, section_id=sec.id) for u, (_, _, roll) in zip(stus_u, sd.DEMO_STUDENTS)])
    await s.flush()
    for p, (day, pn, a, z, ci, fi, ri) in enumerate([(0, 1, "08:00", "08:50", 0, 0, 0), (0, 3, "09:40", "10:30", 1, 1, 1),
                                                      (1, 2, "08:50", "09:40", 0, 0, 0), (2, 4, "10:30", "11:20", 1, 1, 2)]):
        s.add(TimetableSlot(course_id=courses[ci].id, faculty_id=facs[fi].id, room_id=rooms[ri].id, section_id=sec.id, day_of_week=day,
                            period_number=pn, start_time=time.fromisoformat(a), end_time=time.fromisoformat(z),
                            academic_year="2026-27", semester="WINTER"))
    tomorrow = now().date() + timedelta(days=1)
    s.add(RoomBooking(room_id=rooms[3].id, user_id=stus_u[0].id, start_datetime=combine(tomorrow, time(14)), end_datetime=combine(tomorrow, time(15)),
                      purpose="Demo study group", status="CONFIRMED"))
    s.add(RoomMaintenance(room_id=rooms[5].id, start_datetime=combine(tomorrow, time(9)), end_datetime=combine(tomorrow, time(17)),
                          reason="Demo: projector replacement", reported_by=admin.id, status="SCHEDULED"))
    s.add(Notification(user_id=stus_u[0].id, type="BOOKING_CONFIRMED", title="Booking confirmed", message="Demo notification."))
    await seed_periods(s)
    return f"Demo data created in building DEMO (login with the demo emails, password as supplied)."

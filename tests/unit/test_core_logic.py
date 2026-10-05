from datetime import datetime, time, timedelta

import pytest
from pydantic import ValidationError

from app.core.security import hash_password, verify_password
from app.schemas.auth import RegisterRequest
from app.schemas.schedule_change import ScheduleChangeCreate
from app.services.csv_import_service import TimetableImportService
from app.services.timetable_service import SlotKey, find_slot_conflicts
from app.utils.datetime_utils import TZ, overlaps
from app.core.exceptions import ValidationAppError

T0 = datetime(2026, 10, 5, 10, 0, tzinfo=TZ)


def test_overlap_rule_is_half_open():
    h = timedelta(hours=1)
    assert overlaps(T0, T0 + h, T0 + h / 2, T0 + 2 * h)           # partial overlap
    assert overlaps(T0, T0 + 2 * h, T0 + h / 2, T0 + h)           # contained
    assert not overlaps(T0, T0 + h, T0 + h, T0 + 2 * h)           # back-to-back: existing_end == requested_start
    assert not overlaps(T0 + h, T0 + 2 * h, T0, T0 + h)           # back-to-back, other direction


def test_password_hash_roundtrip():
    h = hash_password("S3cret-passphrase")
    assert h != "S3cret-passphrase" and h.startswith("$argon2")
    assert verify_password("S3cret-passphrase", h) and not verify_password("wrong", h)


def test_register_rejects_role_field():
    base = dict(name="A", email="a@b.co", password="longenough123", student_roll_no="21XXX0001", department="CSE", year=2)
    RegisterRequest(**base)
    with pytest.raises(ValidationError):
        RegisterRequest(**base, role="ADMIN")


def test_schedule_change_shape_validation():
    with pytest.raises(ValidationError):
        ScheduleChangeCreate(timetable_slot_id=1, original_date="2026-10-05", change_type="ROOM_CHANGED")
    with pytest.raises(ValidationError):
        ScheduleChangeCreate(timetable_slot_id=1, original_date="2026-10-05", change_type="CANCELLED")
    ScheduleChangeCreate(timetable_slot_id=1, original_date="2026-10-05", change_type="ROOM_CHANGED", new_room_id=2)


def _k(**kw):
    d = dict(id=None, course_id=1, faculty_id=1, room_id=1, section_id=1, day_of_week=0, start_time=time(10), end_time=time(11),
             academic_year="2026-27", semester="W")
    return SlotKey(**{**d, **kw})


def test_slot_conflict_detection():
    existing = [_k(id=1)]
    assert find_slot_conflicts(_k(course_id=9, faculty_id=2, room_id=2, section_id=2), existing) == []
    assert [c for c, _ in find_slot_conflicts(_k(), existing)] == ["DUPLICATE_ENTRY"]
    codes = {c for c, _ in find_slot_conflicts(_k(course_id=9, start_time=time(10, 30), end_time=time(11, 30)), existing)}
    assert codes == {"ROOM_CONFLICT", "FACULTY_CONFLICT", "SECTION_CONFLICT"}
    assert find_slot_conflicts(_k(course_id=9, start_time=time(11), end_time=time(12)), existing) == []  # adjacent is fine
    assert find_slot_conflicts(_k(course_id=9, day_of_week=1), existing) == []
    assert find_slot_conflicts(_k(course_id=9, semester="S"), existing) == []


def test_csv_file_validation():
    parse = TimetableImportService.parse_csv
    with pytest.raises(ValidationAppError) as e:
        parse("data.xlsx", "text/csv", b"a,b")
    assert e.value.code == "INVALID_FILE_TYPE"
    with pytest.raises(ValidationAppError) as e:
        parse("x.csv", "text/csv", b"course_code,room\nA,B\n")
    assert e.value.code == "MISSING_COLUMNS" and "faculty" in e.value.details["missing"]
    with pytest.raises(ValidationAppError) as e:
        parse("x.csv", "text/csv", b"\x00\x01\x02")
    assert e.value.code == "INVALID_FILE_TYPE"

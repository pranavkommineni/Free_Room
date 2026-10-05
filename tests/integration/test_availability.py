from datetime import timedelta

from app.core.database import SessionLocal
from app.models import RoomBooking, RoomMaintenance, RoomRestriction
from app.models.enums import RoomStatus
from tests.conftest import at, auth, availability, iso


async def test_all_active_rooms_available_when_nothing_blocks(client, world):
    names, body = await availability(client, world.stu_user, at(world.free_date, "10:00"), at(world.free_date, "11:00"))
    assert names == {"T1-R101", "T1-R102", "T1-R201"} and body["total_available"] == 3
    r = body["rooms"][0]
    assert {"room_id", "room_number", "floor", "capacity", "has_projector", "has_ac", "available_until"} <= set(r)


async def test_timetable_conflict_blocks_room(client, world, slot):
    d = world.class_date
    names, _ = await availability(client, world.stu_user, at(d, "10:30"), at(d, "11:30"))     # overlaps 10:00-10:50
    assert "T1-R101" not in names and "T1-R102" in names
    names, _ = await availability(client, world.stu_user, at(d, "10:50"), at(d, "11:30"))     # starts exactly when class ends
    assert "T1-R101" in names
    names, _ = await availability(client, world.stu_user, at(d, "09:00"), at(d, "10:00"))     # ends exactly when class starts
    assert "T1-R101" in names


async def test_booking_maintenance_restriction_conflicts(client, world):
    d = world.free_date
    async with SessionLocal() as s:
        s.add_all([
            RoomBooking(room_id=world.r101.id, user_id=world.stu_user.id, start_datetime=at(d, "10:00"), end_datetime=at(d, "11:00"), status="CONFIRMED"),
            RoomMaintenance(room_id=world.r102.id, start_datetime=at(d, "10:30"), end_datetime=at(d, "12:00"), reason="AC", reported_by=world.admin.id, status="SCHEDULED"),
            RoomRestriction(room_id=world.r201.id, start_datetime=at(d, "09:00"), end_datetime=at(d, "12:00"), reason="Exam", created_by=world.admin.id, status="ACTIVE"),
        ])
        await s.commit()
    names, _ = await availability(client, world.stu_user, at(d, "10:15"), at(d, "10:45"))
    assert names == set()
    names, _ = await availability(client, world.stu_user, at(d, "11:00"), at(d, "11:30"))
    assert names == {"T1-R101"}                                  # booking ended; maintenance/restriction still running
    r = await client.get(f"/api/v1/availability/rooms/{world.r102.id}", headers=auth(world.stu_user),
                         params={"start_datetime": iso(at(d, "11:00")), "end_datetime": iso(at(d, "11:30"))})
    assert r.json()["available"] is False and r.json()["conflicts"][0]["code"] == "MAINTENANCE_CONFLICT"


async def test_cancelled_booking_maintenance_and_lifted_restriction_do_not_block(client, world):
    d = world.free_date
    async with SessionLocal() as s:
        s.add_all([
            RoomBooking(room_id=world.r101.id, user_id=world.stu_user.id, start_datetime=at(d, "10:00"), end_datetime=at(d, "11:00"), status="CANCELLED"),
            RoomMaintenance(room_id=world.r102.id, start_datetime=at(d, "10:00"), end_datetime=at(d, "11:00"), reason="x", reported_by=world.admin.id, status="CANCELLED"),
            RoomRestriction(room_id=world.r201.id, start_datetime=at(d, "10:00"), end_datetime=at(d, "11:00"), reason="x", created_by=world.admin.id, status="LIFTED"),
        ])
        await s.commit()
    names, _ = await availability(client, world.stu_user, at(d, "10:00"), at(d, "11:00"))
    assert len(names) == 3


async def test_inactive_room_and_student_accessibility(client, world):
    d = world.free_date
    async with SessionLocal() as s:
        r101 = await s.get(type(world.r101), world.r101.id)
        r101.status = RoomStatus.INACTIVE.value
        r102 = await s.get(type(world.r102), world.r102.id)
        r102.student_accessible = False
        await s.commit()
    student_view, _ = await availability(client, world.stu_user, at(d, "10:00"), at(d, "11:00"))
    faculty_view, _ = await availability(client, world.fac_user, at(d, "10:00"), at(d, "11:00"))
    assert student_view == {"T1-R201"}
    assert faculty_view == {"T1-R102", "T1-R201"}                # inactive never; restricted-to-staff room visible to faculty


async def test_filters(client, world):
    d = world.free_date
    s_, e_ = at(d, "10:00"), at(d, "11:00")
    assert (await availability(client, world.stu_user, s_, e_, has_ac="true"))[0] == {"T1-R201"}
    assert (await availability(client, world.stu_user, s_, e_, has_projector="true"))[0] == {"T1-R101", "T1-R102"}
    assert (await availability(client, world.stu_user, s_, e_, minimum_capacity=50))[0] == {"T1-R101", "T1-R102"}
    assert (await availability(client, world.stu_user, s_, e_, floor_id=world.floor2.id))[0] == {"T1-R201"}


async def test_available_until_is_next_blocker(client, world):
    d = world.free_date
    async with SessionLocal() as s:
        s.add(RoomBooking(room_id=world.r101.id, user_id=world.stu_user.id, start_datetime=at(d, "12:00"), end_datetime=at(d, "13:00"), status="CONFIRMED"))
        await s.commit()
    _, body = await availability(client, world.stu_user, at(d, "10:00"), at(d, "11:00"))
    until = {r["display_name"]: r["available_until"] for r in body["rooms"]}
    assert until["T1-R101"].startswith(f"{d}T12:00") and until["T1-R102"].startswith(f"{d}T18:00")


async def test_naive_datetime_and_bad_interval_rejected(client, world):
    r = await client.get("/api/v1/availability", headers=auth(world.stu_user),
                         params={"start_datetime": "2026-10-10T10:00:00", "end_datetime": "2026-10-10T11:00:00"})
    assert r.status_code == 422
    d = world.free_date
    r = await client.get("/api/v1/availability", headers=auth(world.stu_user),
                         params={"start_datetime": iso(at(d, "11:00")), "end_datetime": iso(at(d, "10:00"))})
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_INTERVAL"


async def test_free_periods_and_break_search(client, world, slot):
    d = world.class_date  # class 10:00-10:50 overlaps P3 (09:40-10:30) and P4 (10:30-11:20)
    r = await client.get("/api/v1/timetable/free-periods", headers=auth(world.stu_user), params={"date": str(d)})
    assert r.status_code == 200, r.text
    st = {p["period_number"]: p["status"] for p in r.json()["periods"]}
    assert st == {1: "FREE", 2: "FREE", 3: "CLASS", 4: "CLASS"}
    assert len(r.json()["free_intervals"]) == 1 and r.json()["free_intervals"][0]["start"].startswith(f"{d}T08:00")
    # break search: ENTIRE interval. R101 is in class at 10:00-10:50 so it is excluded; others stay.
    p = {"start_datetime": iso(at(d, "09:00")), "end_datetime": iso(at(d, "10:30"))}
    b = await client.get("/api/v1/availability/break", headers=auth(world.stu_user), params=p)
    assert b.status_code == 200
    assert {x["display_name"] for x in b.json()["rooms"]} == {"T1-R102", "T1-R201"}
    assert b.json()["student_free"] is False and b.json()["student_conflicts"][0].startswith("CSE101")
    p = {"start_datetime": iso(at(d, "08:00")), "end_datetime": iso(at(d, "09:40"))}
    b = await client.get("/api/v1/availability/break", headers=auth(world.stu_user), params=p)
    assert b.json()["student_free"] is True and b.json()["total_available"] == 3


async def test_student_cannot_view_other_students_free_periods(client, world):
    r = await client.get("/api/v1/timetable/free-periods", headers=auth(world.stu_user),
                         params={"date": str(world.class_date), "student_id": world.stu2.id})
    assert r.status_code == 403
    r = await client.get("/api/v1/timetable/free-periods", headers=auth(world.admin), params={"date": str(world.class_date), "student_id": world.stu2.id})
    assert r.status_code == 200

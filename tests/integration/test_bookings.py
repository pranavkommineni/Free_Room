import asyncio
from datetime import timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.database import SessionLocal
from app.models import AuditLog, Notification, RoomBooking
from app.utils.datetime_utils import now
from tests.conftest import at, auth, iso, post_booking


async def test_successful_booking_creates_notification_and_audit(client, world):
    d = world.free_date
    r = await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "CONFIRMED" and r.json()["user_id"] == world.stu_user.id
    async with SessionLocal() as s:
        n = (await s.execute(select(Notification).where(Notification.user_id == world.stu_user.id))).scalars().all()
        a = (await s.execute(select(AuditLog).where(AuditLog.action == "BOOKING_CREATED"))).scalars().all()
    assert [x.type for x in n] == ["BOOKING_CONFIRMED"] and len(a) == 1 and a[0].new_data["room_id"] == world.r101.id


async def test_overlapping_booking_409_but_adjacent_ok(client, world):
    d = world.free_date
    assert (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))).status_code == 201
    for s_, e_ in (("10:30", "11:30"), ("09:30", "10:30"), ("10:15", "10:45"), ("09:00", "12:00")):
        r = await post_booking(client, world.stu2_user, world.r101, at(d, s_), at(d, e_))
        assert r.status_code == 409, (s_, e_)
        assert r.json()["error"]["code"] == "ROOM_NOT_AVAILABLE" and r.json()["error"]["details"][0]["code"] == "BOOKING_CONFLICT"
    assert (await post_booking(client, world.stu2_user, world.r101, at(d, "11:00"), at(d, "12:00"))).status_code == 201
    assert (await post_booking(client, world.stu2_user, world.r101, at(d, "09:00"), at(d, "10:00"))).status_code == 201
    assert (await post_booking(client, world.stu2_user, world.r102, at(d, "10:00"), at(d, "11:00"))).status_code == 201  # other room


async def test_invalid_intervals(client, world):
    d = world.free_date
    r = await post_booking(client, world.stu_user, world.r101, at(d, "11:00"), at(d, "10:00"))
    assert r.status_code == 422                                             # schema-level
    r = await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "10:05"))
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_DURATION"
    r = await post_booking(client, world.stu_user, world.r101, at(d, "08:00"), at(d, "18:00"))
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_DURATION"
    r = await post_booking(client, world.stu_user, world.r101, at(d + timedelta(days=60), "10:00"), at(d + timedelta(days=60), "11:00"))
    assert r.status_code == 400 and r.json()["error"]["code"] == "BOOKING_TOO_FAR_AHEAD"
    r = await client.post("/api/v1/bookings", headers=auth(world.stu_user), json={
        "room_id": world.r101.id, "start_datetime": "2026-12-01T10:00:00", "end_datetime": "2026-12-01T11:00:00"})
    assert r.status_code == 422                                             # naive datetimes rejected


async def test_past_booking_rejected(client, world):
    start = now() - timedelta(hours=3)
    r = await post_booking(client, world.stu_user, world.r101, start, start + timedelta(hours=1))
    assert r.status_code == 400 and r.json()["error"]["code"] == "BOOKING_IN_PAST"


async def test_unknown_room_404(client, world):
    d = world.free_date
    r = await client.post("/api/v1/bookings", headers=auth(world.stu_user), json={
        "room_id": 9999, "start_datetime": iso(at(d, "10:00")), "end_datetime": iso(at(d, "11:00"))})
    assert r.status_code == 404 and r.json()["error"]["code"] == "ROOM_NOT_FOUND"


async def test_cannot_book_during_class_maintenance_restriction(client, world, slot):
    d = world.class_date
    r = await post_booking(client, world.stu_user, world.r101, at(d, "10:30"), at(d, "11:30"))
    assert r.status_code == 409 and r.json()["error"]["details"][0]["code"] == "TIMETABLE_CONFLICT"
    h = auth(world.admin)
    m = await client.post("/api/v1/maintenance", headers=h, json={"room_id": world.r102.id, "start_datetime": iso(at(d, "09:00")),
                                                                   "end_datetime": iso(at(d, "12:00")), "reason": "Painting"})
    assert m.status_code == 201
    assert (await post_booking(client, world.stu_user, world.r102, at(d, "10:00"), at(d, "11:00"))).json()["error"]["details"][0]["code"] == "MAINTENANCE_CONFLICT"
    x = await client.post("/api/v1/restrictions", headers=h, json={"room_id": world.r201.id, "start_datetime": iso(at(d, "09:00")),
                                                                    "end_datetime": iso(at(d, "12:00")), "reason": "Exam"})
    assert x.status_code == 201
    assert (await post_booking(client, world.stu_user, world.r201, at(d, "10:00"), at(d, "11:00"))).json()["error"]["details"][0]["code"] == "RESTRICTION_CONFLICT"
    # lifting the restriction frees the room again
    assert (await client.delete(f"/api/v1/restrictions/{x.json()['id']}", headers=h)).status_code == 204
    assert (await post_booking(client, world.stu_user, world.r201, at(d, "10:00"), at(d, "11:00"))).status_code == 201


async def test_student_cannot_book_staff_only_room_but_faculty_can(client, world):
    d = world.free_date
    await client.put(f"/api/v1/rooms/{world.r101.id}", headers=auth(world.admin), json={"student_accessible": False})
    r = await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))
    assert r.status_code == 409 and r.json()["error"]["details"][0]["code"] == "ROOM_NOT_STUDENT_ACCESSIBLE"
    assert (await post_booking(client, world.fac_user, world.r101, at(d, "10:00"), at(d, "11:00"))).status_code == 201


async def test_cancel_booking_keeps_history_and_frees_room(client, world):
    d = world.free_date
    b = (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))).json()
    assert (await client.delete(f"/api/v1/bookings/{b['id']}", headers=auth(world.stu2_user))).status_code == 403   # not the owner
    r = await client.delete(f"/api/v1/bookings/{b['id']}", headers=auth(world.stu_user))
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    assert (await client.delete(f"/api/v1/bookings/{b['id']}", headers=auth(world.stu_user))).status_code == 409   # already cancelled
    async with SessionLocal() as s:
        assert (await s.get(RoomBooking, b["id"])).status == "CANCELLED"                                             # row still exists
    assert (await post_booking(client, world.stu2_user, world.r101, at(d, "10:00"), at(d, "11:00"))).status_code == 201


async def test_admin_can_cancel_others_booking_and_owner_is_notified(client, world):
    d = world.free_date
    b = (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))).json()
    assert (await client.delete(f"/api/v1/bookings/{b['id']}", headers=auth(world.admin))).status_code == 200
    n = (await client.get("/api/v1/notifications", headers=auth(world.stu_user))).json()
    assert "BOOKING_CANCELLED" in [x["type"] for x in n["items"]]


async def test_students_only_see_own_bookings(client, world):
    d = world.free_date
    await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))
    await post_booking(client, world.stu2_user, world.r102, at(d, "10:00"), at(d, "11:00"))
    assert (await client.get("/api/v1/bookings", headers=auth(world.stu_user))).json()["total"] == 1
    assert (await client.get("/api/v1/bookings", headers=auth(world.fac_user))).json()["total"] == 2


async def test_concurrent_booking_attempts_only_one_wins(client, world):
    """Many simultaneous requests for the same room/time: exactly one 201, the rest 409."""
    d = world.free_date
    users = [world.stu_user, world.stu2_user, world.fac_user, world.fac2_user, world.admin] * 3
    results = await asyncio.gather(*[post_booking(client, u, world.r101, at(d, "10:00"), at(d, "11:00")) for u in users])
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 1 and codes.count(409) == len(users) - 1, codes
    async with SessionLocal() as s:
        rows = (await s.execute(select(RoomBooking).where(RoomBooking.status == "CONFIRMED"))).scalars().all()
    assert len(rows) == 1


async def test_concurrent_overlapping_but_different_windows(client, world):
    d = world.free_date
    windows = [("10:00", "11:00"), ("10:30", "11:30"), ("11:00", "12:00"), ("10:45", "11:15"), ("09:00", "10:00"), ("09:30", "10:30")]
    results = await asyncio.gather(*[post_booking(client, world.stu_user, world.r101, at(d, a), at(d, b)) for a, b in windows])
    ok = [(a, b) for (a, b), r in zip(windows, results) if r.status_code == 201]
    for i, (a1, b1) in enumerate(ok):                                       # whatever won must be pairwise non-overlapping
        for a2, b2 in ok[i + 1:]:
            assert not (a1 < b2 and b1 > a2), (ok,)
    assert len(ok) >= 2


async def test_database_exclusion_constraint_is_the_last_line_of_defence(world):
    """Bypass the service entirely: PostgreSQL itself must refuse overlapping active bookings."""
    d = world.free_date
    async with SessionLocal() as s:
        s.add(RoomBooking(room_id=world.r101.id, user_id=world.stu_user.id, start_datetime=at(d, "10:00"), end_datetime=at(d, "11:00"), status="CONFIRMED"))
        await s.commit()
    async with SessionLocal() as s:
        s.add(RoomBooking(room_id=world.r101.id, user_id=world.stu2_user.id, start_datetime=at(d, "10:30"), end_datetime=at(d, "11:30"), status="CONFIRMED"))
        with pytest.raises(IntegrityError) as e:
            await s.commit()
        assert "ex_room_bookings_no_overlap" in str(e.value)
    async with SessionLocal() as s:  # cancelled rows don't participate; invalid interval is rejected by CHECK
        s.add(RoomBooking(room_id=world.r101.id, user_id=world.stu2_user.id, start_datetime=at(d, "10:30"), end_datetime=at(d, "11:30"), status="CANCELLED"))
        await s.commit()
        s.add(RoomBooking(room_id=world.r101.id, user_id=world.stu2_user.id, start_datetime=at(d, "12:00"), end_datetime=at(d, "11:00"), status="CONFIRMED"))
        with pytest.raises(IntegrityError):
            await s.commit()


async def test_maintenance_cancels_existing_bookings_and_notifies(client, world):
    d = world.free_date
    b = (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))).json()
    m = await client.post("/api/v1/maintenance", headers=auth(world.admin), json={
        "room_id": world.r101.id, "start_datetime": iso(at(d, "09:00")), "end_datetime": iso(at(d, "12:00")), "reason": "Leak"})
    assert m.status_code == 201
    assert (await client.get(f"/api/v1/bookings/{b['id']}", headers=auth(world.stu_user))).json()["status"] == "CANCELLED"
    types = [x["type"] for x in (await client.get("/api/v1/notifications", headers=auth(world.stu_user))).json()["items"]]
    assert "ROOM_UNAVAILABLE" in types

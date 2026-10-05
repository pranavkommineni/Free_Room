from datetime import time, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import AuditLog, Notification, ScheduleChange, TimetableSlot
from tests.conftest import at, auth, availability, iso, post_booking


async def add_slot(world, **kw):
    d = dict(course_id=world.course2.id, faculty_id=world.fac2.id, room_id=world.r102.id, section_id=world.section2.id,
             day_of_week=world.free_date.weekday(), period_number=5, start_time=time(14), end_time=time(14, 50),
             academic_year="2026-27", semester="WINTER")
    async with SessionLocal() as s:
        sl = TimetableSlot(**{**d, **kw})
        s.add(sl)
        await s.commit()
        await s.refresh(sl)
    return sl


def req(world, slot, **kw):
    body = {"timetable_slot_id": slot.id, "original_date": str(world.class_date), "change_type": "RESCHEDULED",
            "new_date": str(world.free_date), "new_start_time": "14:00", "new_end_time": "14:50", "new_room_id": world.r102.id, "reason": "Conference"}
    return {**body, **kw}


async def notes(client, user):
    return [n["type"] for n in (await client.get("/api/v1/notifications", headers=auth(user))).json()["items"]]


async def test_valid_request_is_pending_and_timetable_untouched(client, world, slot):
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "PENDING" and r.json()["requested_by"] == world.fac_user.id and r.json()["original_room_id"] == world.r101.id
    assert "RESCHEDULE_REQUESTED" in await notes(client, world.admin)
    async with SessionLocal() as s:
        sl = await s.get(TimetableSlot, slot.id)
        assert (sl.room_id, sl.start_time, sl.day_of_week) == (world.r101.id, time(10), world.class_date.weekday())
    # pending change has NO effect on availability yet
    names, _ = await availability(client, world.admin, at(world.class_date, "10:00"), at(world.class_date, "10:50"))
    assert "T1-R101" not in names
    names, _ = await availability(client, world.admin, at(world.free_date, "14:00"), at(world.free_date, "14:50"))
    assert "T1-R102" in names


async def test_invalid_room_and_authorisation(client, world, slot):
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot, new_room_id=9999))
    assert r.status_code == 404 and r.json()["error"]["code"] == "ROOM_NOT_FOUND"
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac2_user), json=req(world, slot))
    assert r.status_code == 403 and r.json()["error"]["code"] == "NOT_SLOT_OWNER"
    assert (await client.post("/api/v1/schedule-changes", headers=auth(world.stu_user), json=req(world, slot))).status_code == 403
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot, original_date=str(world.class_date + timedelta(days=1))))
    assert r.status_code == 400 and r.json()["error"]["code"] == "NO_SUCH_OCCURRENCE"


async def test_conflicting_room_class_booking_and_faculty(client, world, slot):
    await add_slot(world)                                      # fac2 teaches section B in R102 on free_date 14:00
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))
    assert r.status_code == 409 and r.json()["error"]["details"][0]["code"] == "TIMETABLE_CONFLICT"
    # free room, but a booking sits there
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot, new_room_id=world.r201.id))
    assert r.status_code == 201
    await client.delete(f"/api/v1/schedule-changes/{r.json()['id']}", headers=auth(world.fac_user))
    assert (await post_booking(client, world.stu_user, world.r201, at(world.free_date, "14:00"), at(world.free_date, "15:00"))).status_code == 201
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot, new_room_id=world.r201.id))
    assert r.status_code == 409 and r.json()["error"]["details"][0]["code"] == "BOOKING_CONFLICT"


async def test_conflicting_time_faculty_and_section(client, world, slot):
    await add_slot(world, faculty_id=world.fac.id, room_id=world.r201.id, section_id=world.section2.id)   # fac1 busy 14:00 free_date
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))
    assert r.status_code == 409 and r.json()["error"]["code"] == "FACULTY_CONFLICT"
    await add_slot(world, faculty_id=world.fac2.id, room_id=world.r102.id, section_id=world.section.id, start_time=time(15), end_time=time(15, 50))
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot, new_start_time="15:00", new_end_time="15:50", new_room_id=world.r201.id))
    assert r.status_code == 409 and r.json()["error"]["code"] == "SECTION_CONFLICT"


async def test_duplicate_open_request_409(client, world, slot):
    assert (await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))).status_code == 201
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot, new_room_id=world.r201.id))
    assert r.status_code == 409 and r.json()["error"]["code"] == "CHANGE_ALREADY_EXISTS"


async def test_approval_changes_effective_schedule_and_notifies(client, world, slot):
    c = (await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))).json()
    assert (await client.put(f"/api/v1/schedule-changes/{c['id']}/approve", headers=auth(world.stu_user))).status_code == 403   # Rule 8
    assert (await client.put(f"/api/v1/schedule-changes/{c['id']}/approve", headers=auth(world.fac_user))).status_code == 403
    r = await client.put(f"/api/v1/schedule-changes/{c['id']}/approve", headers=auth(world.admin), json={"note": "ok"})
    assert r.status_code == 200 and r.json()["status"] == "APPROVED" and r.json()["approved_by"] == world.admin.id
    # old room released, new room occupied
    names, _ = await availability(client, world.admin, at(world.class_date, "10:00"), at(world.class_date, "10:50"))
    assert "T1-R101" in names
    names, _ = await availability(client, world.admin, at(world.free_date, "14:00"), at(world.free_date, "14:50"))
    assert "T1-R102" not in names
    # students see the moved class; faculty too; original date empty
    tt = (await client.get("/api/v1/timetable/me", headers=auth(world.stu_user), params={"from_date": str(world.free_date)})).json()
    assert [(o["course_code"], o["room"], o["source"]) for o in tt] == [("CSE101", "T1-R102", "RESCHEDULED")]
    assert (await client.get("/api/v1/timetable/me", headers=auth(world.stu_user), params={"from_date": str(world.class_date)})).json() == []
    assert len((await client.get("/api/v1/timetable/me", headers=auth(world.fac_user), params={"from_date": str(world.free_date)})).json()) == 1
    # notifications + audit
    assert "RESCHEDULE_APPROVED" in await notes(client, world.fac_user)
    assert "CLASS_RESCHEDULED" in await notes(client, world.stu_user) and "CLASS_RESCHEDULED" in await notes(client, world.stu2_user)
    assert "CLASS_RESCHEDULED" not in await notes(client, world.fac_user)
    async with SessionLocal() as s:
        acts = {a.action for a in (await s.execute(select(AuditLog))).scalars()}
    assert {"SCHEDULE_CHANGE_REQUESTED", "SCHEDULE_CHANGE_APPROVED"} <= acts
    # approving twice is a state error; the recurring slot is still untouched
    assert (await client.put(f"/api/v1/schedule-changes/{c['id']}/approve", headers=auth(world.admin))).status_code == 409
    async with SessionLocal() as s:
        assert (await s.get(TimetableSlot, slot.id)).room_id == world.r101.id


async def test_rejection_keeps_schedule_and_notifies_faculty(client, world, slot):
    c = (await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))).json()
    r = await client.put(f"/api/v1/schedule-changes/{c['id']}/reject", headers=auth(world.admin), json={"note": "Room needed"})
    assert r.status_code == 200 and r.json()["status"] == "REJECTED" and r.json()["rejected_at"]
    assert "RESCHEDULE_REJECTED" in await notes(client, world.fac_user)
    assert "CLASS_RESCHEDULED" not in await notes(client, world.stu_user)
    names, _ = await availability(client, world.admin, at(world.class_date, "10:00"), at(world.class_date, "10:50"))
    assert "T1-R101" not in names                                                     # Rule 7: nothing changed
    assert (await client.put(f"/api/v1/schedule-changes/{c['id']}/approve", headers=auth(world.admin))).status_code == 409
    # after a rejection the faculty may submit a new request
    assert (await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))).status_code == 201


async def test_approval_revalidates_against_current_state(client, world, slot):
    c = (await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json=req(world, slot))).json()
    assert (await post_booking(client, world.stu_user, world.r102, at(world.free_date, "14:00"), at(world.free_date, "15:00"))).status_code == 201
    r = await client.put(f"/api/v1/schedule-changes/{c['id']}/approve", headers=auth(world.admin))
    assert r.status_code == 409 and r.json()["error"]["details"][0]["code"] == "BOOKING_CONFLICT"
    async with SessionLocal() as s:
        assert (await s.get(ScheduleChange, c["id"])).status == "PENDING"            # rolled back


async def test_cancel_single_occurrence_releases_room(client, world, slot):
    d = world.class_date
    assert "T1-R101" not in (await availability(client, world.admin, at(d, "10:00"), at(d, "10:50")))[0]
    assert (await client.post("/api/v1/schedule-changes/cancel-occurrence", headers=auth(world.fac2_user),
                              json={"timetable_slot_id": slot.id, "original_date": str(d)})).status_code == 403
    r = await client.post("/api/v1/schedule-changes/cancel-occurrence", headers=auth(world.fac_user),
                          json={"timetable_slot_id": slot.id, "original_date": str(d), "reason": "Ill"})
    assert r.status_code == 201 and r.json()["change_type"] == "CANCELLED" and r.json()["status"] == "APPROVED"
    assert "T1-R101" in (await availability(client, world.admin, at(d, "10:00"), at(d, "10:50")))[0]
    assert "CLASS_CANCELLED" in await notes(client, world.stu_user)
    # the NEXT week's occurrence is unaffected, and the recurring slot still exists
    nxt = d + timedelta(days=7)
    assert "T1-R101" not in (await availability(client, world.admin, at(nxt, "10:00"), at(nxt, "10:50")))[0]
    assert (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))).status_code == 201   # room is bookable now
    assert (await client.post("/api/v1/schedule-changes/cancel-occurrence", headers=auth(world.fac_user),
                              json={"timetable_slot_id": slot.id, "original_date": str(d)})).status_code == 409
    free = (await client.get("/api/v1/timetable/me", headers=auth(world.stu_user), params={"from_date": str(d)})).json()
    assert free == []


async def test_withdraw_approved_change_restores_original(client, world, slot):
    d = world.class_date
    c = (await client.post("/api/v1/schedule-changes/cancel-occurrence", headers=auth(world.fac_user),
                           json={"timetable_slot_id": slot.id, "original_date": str(d)})).json()
    assert (await client.delete(f"/api/v1/schedule-changes/{c['id']}", headers=auth(world.fac2_user))).status_code == 403
    r = await client.delete(f"/api/v1/schedule-changes/{c['id']}", headers=auth(world.fac_user))
    assert r.status_code == 200 and r.json()["status"] == "CANCELLED"
    assert "T1-R101" not in (await availability(client, world.admin, at(d, "10:00"), at(d, "10:50")))[0]


async def test_room_change_and_time_change(client, world, slot):
    d = world.class_date
    rc = (await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json={
        "timetable_slot_id": slot.id, "original_date": str(d), "change_type": "ROOM_CHANGED", "new_room_id": world.r201.id})).json()
    assert (rc["new_date"], rc["new_start_time"]) == (str(d), "10:00:00")
    await client.put(f"/api/v1/schedule-changes/{rc['id']}/approve", headers=auth(world.admin))
    names, _ = await availability(client, world.admin, at(d, "10:00"), at(d, "10:50"))
    assert "T1-R101" in names and "T1-R201" not in names
    assert (await post_booking(client, world.stu_user, world.r201, at(d, "10:20"), at(d, "10:40"))).status_code == 409
    await client.delete(f"/api/v1/schedule-changes/{rc['id']}", headers=auth(world.fac_user))
    # time change inside the same room: 10:30-11:20 overlaps the ORIGINAL 10:00-10:50 yet must be allowed
    tc = await client.post("/api/v1/schedule-changes", headers=auth(world.fac_user), json={
        "timetable_slot_id": slot.id, "original_date": str(d), "change_type": "TIME_CHANGED", "new_start_time": "10:30", "new_end_time": "11:20"})
    assert tc.status_code == 201, tc.text
    await client.put(f"/api/v1/schedule-changes/{tc.json()['id']}/approve", headers=auth(world.admin))
    names_early, _ = await availability(client, world.admin, at(d, "10:00"), at(d, "10:30"))
    names_late, _ = await availability(client, world.admin, at(d, "11:00"), at(d, "11:20"))
    assert "T1-R101" in names_early and "T1-R101" not in names_late


async def test_admin_requests_are_auto_approved_and_listing_scoped(client, world, slot):
    r = await client.post("/api/v1/schedule-changes", headers=auth(world.admin), json=req(world, slot))
    assert r.status_code == 201 and r.json()["status"] == "APPROVED"
    assert (await client.get("/api/v1/schedule-changes", headers=auth(world.fac_user))).json()["total"] == 0   # not theirs
    assert (await client.get("/api/v1/schedule-changes", headers=auth(world.admin))).json()["total"] == 1
    assert (await client.get("/api/v1/schedule-changes", headers=auth(world.stu_user))).status_code == 403


async def test_normal_recurring_class_appears_every_week(client, world, slot):
    for k in range(3):
        d = world.class_date + timedelta(days=7 * k)
        tt = (await client.get("/api/v1/timetable/me", headers=auth(world.stu_user), params={"from_date": str(d)})).json()
        assert [o["source"] for o in tt] == ["REGULAR"] and tt[0]["start"].startswith(f"{d}T10:00")

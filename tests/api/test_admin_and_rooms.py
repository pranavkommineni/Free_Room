from datetime import time

from tests.conftest import at, auth, iso, post_booking


async def test_room_crud_and_soft_delete(client, world):
    h = auth(world.admin)
    r = await client.post("/api/v1/rooms", headers=h, json={"floor_id": world.floor1.id, "room_number": "R103", "capacity": 70, "has_projector": True})
    assert r.status_code == 201 and r.json()["display_name"] == "T1-R103" and r.json()["status"] == "ACTIVE"
    rid = r.json()["id"]
    dup = await client.post("/api/v1/rooms", headers=h, json={"floor_id": world.floor2.id, "room_number": "R103", "capacity": 10})
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "ROOM_ALREADY_EXISTS"          # unique per building
    assert (await client.post("/api/v1/rooms", headers=h, json={"floor_id": world.floor1.id, "room_number": "Z", "capacity": 0})).status_code == 422
    assert (await client.put(f"/api/v1/rooms/{rid}", headers=h, json={"capacity": 55})).json()["capacity"] == 55
    assert (await client.delete(f"/api/v1/rooms/{rid}", headers=h)).status_code == 204
    assert (await client.get(f"/api/v1/rooms/{rid}", headers=h)).json()["status"] == "INACTIVE"      # row preserved
    assert (await client.get(f"/api/v1/rooms/{rid}", headers=auth(world.stu_user))).status_code == 404
    listing = (await client.get("/api/v1/rooms", headers=auth(world.stu_user))).json()
    assert listing["total"] == 3
    logs = (await client.get("/api/v1/admin/audit-logs", headers=h, params={"entity_type": "room"})).json()
    assert {l["action"] for l in logs["items"]} == {"ROOM_CREATED", "ROOM_UPDATED"}
    assert (await client.get("/api/v1/admin/audit-logs", headers=auth(world.fac_user))).status_code == 403


async def test_deactivating_room_cancels_future_bookings(client, world):
    d = world.free_date
    b = (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))).json()
    await client.delete(f"/api/v1/rooms/{world.r101.id}", headers=auth(world.admin))
    assert (await client.get(f"/api/v1/bookings/{b['id']}", headers=auth(world.stu_user))).json()["status"] == "CANCELLED"


async def test_pagination_and_buildings(client, world):
    r = (await client.get("/api/v1/rooms", headers=auth(world.admin), params={"page": 2, "page_size": 2})).json()
    assert (r["total"], r["page"], r["page_size"], len(r["items"])) == (3, 2, 2, 1)
    assert (await client.get("/api/v1/rooms", headers=auth(world.admin), params={"page_size": 1000})).status_code == 422
    b = (await client.get("/api/v1/buildings", headers=auth(world.stu_user))).json()
    assert b[0]["code"] == "T1" and [f["floor_number"] for f in b[0]["floors"]] == [1, 2]


async def test_maintenance_and_restriction_permissions(client, world):
    d = world.free_date
    body = {"room_id": world.r101.id, "start_datetime": iso(at(d, "09:00")), "end_datetime": iso(at(d, "10:00")), "reason": "x"}
    for u in (world.stu_user, world.fac_user):
        assert (await client.post("/api/v1/maintenance", headers=auth(u), json=body)).status_code == 403
        assert (await client.post("/api/v1/restrictions", headers=auth(u), json=body)).status_code == 403
    m = await client.post("/api/v1/maintenance", headers=auth(world.admin), json=body)
    assert m.status_code == 201
    assert (await client.get("/api/v1/maintenance", headers=auth(world.fac_user))).json()["total"] == 1
    assert (await client.get("/api/v1/maintenance", headers=auth(world.stu_user))).status_code == 403
    bad = await client.post("/api/v1/maintenance", headers=auth(world.admin), json={**body, "end_datetime": body["start_datetime"]})
    assert bad.status_code == 422
    assert (await client.delete(f"/api/v1/maintenance/{m.json()['id']}", headers=auth(world.admin))).status_code == 204
    assert (await client.get("/api/v1/maintenance", headers=auth(world.admin), params={"status": "CANCELLED"})).json()["total"] == 1


async def test_slot_management_conflicts_and_cancels_bookings(client, world):
    h = auth(world.admin)
    d = world.class_date
    b = (await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "10:30"))).json()
    body = {"course_id": world.course.id, "faculty_id": world.fac.id, "room_id": world.r101.id, "section_id": world.section.id,
            "day_of_week": d.weekday(), "period_number": 3, "start_time": "10:00", "end_time": "10:50", "academic_year": "2026-27", "semester": "WINTER"}
    s = await client.post("/api/v1/timetable/slots", headers=h, json=body)
    assert s.status_code == 201, s.text
    assert (await client.get(f"/api/v1/bookings/{b['id']}", headers=auth(world.stu_user))).json()["status"] == "CANCELLED"   # class wins
    dup = await client.post("/api/v1/timetable/slots", headers=h, json=body)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "DUPLICATE_ENTRY"
    clash = await client.post("/api/v1/timetable/slots", headers=h, json={**body, "course_id": world.course2.id, "faculty_id": world.fac2.id, "section_id": world.section2.id, "start_time": "10:30", "end_time": "11:00"})
    assert clash.status_code == 409 and clash.json()["error"]["code"] == "ROOM_CONFLICT"
    assert (await client.delete(f"/api/v1/timetable/slots/{s.json()['id']}", headers=h)).status_code == 204
    assert (await client.get("/api/v1/timetable/slots", headers=h)).json()["total"] == 0
    assert (await client.get("/api/v1/timetable/slots", headers=h, params={"active_only": "false"})).json()["total"] == 1   # soft delete


async def test_notifications_read_flow(client, world):
    d = world.free_date
    await post_booking(client, world.stu_user, world.r101, at(d, "10:00"), at(d, "11:00"))
    h = auth(world.stu_user)
    assert (await client.get("/api/v1/notifications/unread-count", headers=h)).json() == {"unread": 1}
    nid = (await client.get("/api/v1/notifications", headers=h)).json()["items"][0]["id"]
    assert (await client.put(f"/api/v1/notifications/{nid}/read", headers=auth(world.stu2_user))).status_code == 404   # not yours
    assert (await client.put(f"/api/v1/notifications/{nid}/read", headers=h)).json()["is_read"] is True
    assert (await client.get("/api/v1/notifications", headers=h, params={"unread_only": "true"})).json()["total"] == 0


async def test_recommendations_are_ranked_and_explained(client, world):
    d = world.free_date
    p = {"start_datetime": iso(at(d, "10:00")), "end_datetime": iso(at(d, "11:00")), "expected_attendance": 35, "has_ac": "true"}
    r = await client.get("/api/v1/availability/recommendations", headers=auth(world.stu_user), params=p)
    assert r.status_code == 200
    rooms = r.json()["rooms"]
    assert rooms[0]["display_name"] == "T1-R201"                       # tight capacity fit + AC requested
    assert [x["score"] for x in rooms] == sorted((x["score"] for x in rooms), reverse=True)
    assert abs(sum(r.json()["weights"].values()) - 1.0) < 1e-9 and set(rooms[0]["score_breakdown"]) == {"availability", "capacity", "facility", "utilization", "floor"}
    p["expected_attendance"] = 60                                      # R201 (cap 40) can no longer fit
    assert "T1-R201" not in {x["display_name"] for x in (await client.get("/api/v1/availability/recommendations", headers=auth(world.stu_user), params=p)).json()["rooms"]}


async def test_analytics_use_real_data(client, world, slot):
    d = world.free_date
    await post_booking(client, world.stu_user, world.r102, at(d, "10:00"), at(d, "12:00"))
    b2 = (await post_booking(client, world.stu_user, world.r201, at(d, "10:00"), at(d, "11:00"))).json()
    await client.delete(f"/api/v1/bookings/{b2['id']}", headers=auth(world.stu_user))
    h = auth(world.admin)
    rng = {"start_datetime": iso(at(d, "00:00")), "end_datetime": iso(at(d, "23:59"))}
    rooms = (await client.get("/api/v1/admin/analytics/rooms", headers=h)).json()
    assert (rooms["total_rooms"], rooms["active_rooms"], rooms["inactive_rooms"], rooms["available_now"]) == (3, 3, 0, 3)
    bk = (await client.get("/api/v1/admin/analytics/bookings", headers=h, params=rng)).json()
    assert bk["total_bookings"] == 2 and bk["cancellation_count"] == 1 and bk["cancellation_rate"] == 0.5 and bk["by_status"]["CONFIRMED"] == 1
    u = (await client.get("/api/v1/admin/analytics/utilization", headers=h, params={"start_datetime": iso(at(world.class_date, "00:00")), "end_datetime": iso(at(world.class_date, "23:59"))})).json()
    by = {x["display_name"]: x for x in u["rooms"]}
    assert by["T1-R101"]["class_hours"] == 0.83 or abs(by["T1-R101"]["class_hours"] - 50 / 60) < 0.01        # class 10:00-10:50
    assert u["most_used"][0]["display_name"] == "T1-R101" and u["least_used"][0]["total_hours"] == 0
    u = (await client.get("/api/v1/admin/analytics/utilization", headers=h, params=rng)).json()
    assert {x["display_name"]: x["booked_hours"] for x in u["rooms"]}["T1-R102"] == 2.0
    assert (await client.get("/api/v1/admin/analytics/rooms", headers=auth(world.stu_user))).status_code == 403


async def test_error_envelope_and_health(client, world):
    r = await client.get("/api/v1/rooms/99999", headers=auth(world.admin))
    assert r.status_code == 404 and r.json()["success"] is False and set(r.json()["error"]) >= {"code", "message"}
    assert (await client.get("/api/v1/nope")).status_code == 404
    assert (await client.get("/health")).json()["status"] == "ok"
    assert (await client.get("/openapi.json")).status_code == 200 and (await client.get("/docs")).status_code == 200

from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models import TimetableSlot
from tests.conftest import auth

HEADER = "course_code,faculty,room,day,period,start_time,end_time,section,academic_year,semester\n"
ROW1 = "CSE101,F001,T1-R101,MON,1,08:00,08:50,CSE-2-A,2026-27,WINTER\n"
ROW2 = "CSE102,F002,T1-R102,TUE,2,08:50,09:40,CSE-2-B,2026-27,WINTER\n"


async def upload(client, user, text, name="tt.csv", ctype="text/csv"):
    return await client.post("/api/v1/admin/timetable/import", headers=auth(user), files={"file": (name, text.encode(), ctype)})


async def slot_count():
    async with SessionLocal() as s:
        return (await s.execute(select(func.count()).select_from(TimetableSlot))).scalar_one()


async def test_valid_import_preview_then_confirm(client, world):
    r = await upload(client, world.admin, HEADER + ROW1 + ROW2)
    assert r.status_code == 200, r.text
    p = r.json()
    assert (p["total_rows"], p["valid_rows"], p["error_count"], p["can_commit"]) == (2, 2, 0, True)
    assert await slot_count() == 0                                           # preview writes nothing
    c = await client.post(f"/api/v1/admin/timetable/import/{p['import_id']}/confirm", headers=auth(world.admin))
    assert c.status_code == 200 and c.json()["inserted"] == 2 and c.json()["status"] == "COMMITTED"
    assert await slot_count() == 2
    assert (await client.post(f"/api/v1/admin/timetable/import/{p['import_id']}/confirm", headers=auth(world.admin))).status_code == 409
    slots = (await client.get("/api/v1/timetable/slots", headers=auth(world.admin))).json()
    assert slots["total"] == 2 and {s["day_of_week"] for s in slots["items"]} == {0, 1}


async def test_missing_column_and_bad_file_type(client, world):
    r = await upload(client, world.admin, "course_code,faculty,room\nCSE101,F001,T1-R101\n")
    assert r.status_code == 400 and r.json()["error"]["code"] == "MISSING_COLUMNS"
    r = await upload(client, world.admin, HEADER + ROW1, name="tt.txt")
    assert r.status_code == 400 and r.json()["error"]["code"] == "INVALID_FILE_TYPE"
    r = await upload(client, world.admin, HEADER)
    assert r.status_code == 400 and r.json()["error"]["code"] == "EMPTY_FILE"
    assert (await upload(client, world.fac_user, HEADER + ROW1)).status_code == 403


async def test_invalid_references_are_reported_per_row(client, world):
    bad = (HEADER + "NOPE999,F001,T1-R101,MON,1,08:00,08:50,CSE-2-A,2026-27,WINTER\n"
           "CSE101,F777,T1-R101,MON,1,08:00,08:50,CSE-2-A,2026-27,WINTER\n"
           "CSE101,F001,T1-R999,MON,1,08:00,08:50,CSE-2-A,2026-27,WINTER\n"
           "CSE101,F001,T1-R101,MON,1,08:00,08:50,NOSEC,2026-27,WINTER\n"
           "CSE101,F001,T1-R101,FUNDAY,x,9am,08:50,CSE-2-A,2026-27,WINTER\n"
           "CSE101,F001,T1-R101,MON,1,09:00,08:00,CSE-2-A,2026-27,WINTER\n" + ROW1)
    p = (await upload(client, world.admin, bad)).json()
    by_row = {}
    for e in p["errors"]:
        by_row.setdefault(e["row"], set()).add(e["code"])
    assert by_row[2] == {"COURSE_NOT_FOUND"} and by_row[3] == {"FACULTY_NOT_FOUND"} and by_row[4] == {"ROOM_NOT_FOUND"}
    assert by_row[5] == {"SECTION_NOT_FOUND"} and by_row[6] == {"INVALID_DAY", "INVALID_PERIOD", "INVALID_TIME"} and by_row[7] == {"TIME_ORDER"}
    assert p["valid_rows"] == 1 and p["can_commit"] is False
    c = await client.post(f"/api/v1/admin/timetable/import/{p['import_id']}/confirm", headers=auth(world.admin))
    assert c.status_code == 409 and c.json()["error"]["code"] == "IMPORT_HAS_ERRORS" and await slot_count() == 0     # atomic: nothing written
    c = await client.post(f"/api/v1/admin/timetable/import/{p['import_id']}/confirm", headers=auth(world.admin), params={"allow_partial": "true"})
    assert c.status_code == 200 and c.json()["inserted"] == 1 and c.json()["skipped"] == 6 and await slot_count() == 1


async def test_duplicate_entry_against_existing_data(client, world):
    p = (await upload(client, world.admin, HEADER + ROW1)).json()
    await client.post(f"/api/v1/admin/timetable/import/{p['import_id']}/confirm", headers=auth(world.admin))
    again = (await upload(client, world.admin, HEADER + ROW1)).json()
    assert [e["code"] for e in again["errors"]] == ["DUPLICATE_ENTRY"] and again["can_commit"] is False


async def test_conflicting_rows_inside_file_and_against_db(client, world):
    in_file = HEADER + ROW1 + "CSE102,F002,T1-R101,MON,1,08:20,09:10,CSE-2-B,2026-27,WINTER\n"        # same room, overlapping
    p = (await upload(client, world.admin, in_file)).json()
    assert p["valid_rows"] == 1 and [(e["row"], e["code"]) for e in p["errors"]] == [(3, "ROOM_CONFLICT")]
    fac = HEADER + ROW1 + "CSE102,F001,T1-R102,MON,2,08:30,09:20,CSE-2-B,2026-27,WINTER\n"
    assert [e["code"] for e in (await upload(client, world.admin, fac)).json()["errors"]] == ["FACULTY_CONFLICT"]
    sec = HEADER + ROW1 + "CSE102,F002,T1-R102,MON,2,08:30,09:20,CSE-2-A,2026-27,WINTER\n"
    assert [e["code"] for e in (await upload(client, world.admin, sec)).json()["errors"]] == ["SECTION_CONFLICT"]
    # conflicts with already-committed timetable
    ok = (await upload(client, world.admin, HEADER + ROW1)).json()
    await client.post(f"/api/v1/admin/timetable/import/{ok['import_id']}/confirm", headers=auth(world.admin))
    clash = (await upload(client, world.admin, HEADER + "CSE102,F002,T1-R101,MON,1,08:00,08:50,CSE-2-B,2026-27,WINTER\n")).json()
    assert [e["code"] for e in clash["errors"]] == ["ROOM_CONFLICT"]
    # different semester does not conflict
    other = (await upload(client, world.admin, HEADER + "CSE102,F002,T1-R101,MON,1,08:00,08:50,CSE-2-B,2026-27,WINTER\n".replace("WINTER", "WINTER"))).json()
    assert other["can_commit"] is False


async def test_stale_preview_is_revalidated_on_confirm(client, world):
    a = (await upload(client, world.admin, HEADER + ROW1)).json()
    b = (await upload(client, world.admin, HEADER + ROW1)).json()           # both previews look valid
    assert a["can_commit"] and b["can_commit"]
    assert (await client.post(f"/api/v1/admin/timetable/import/{a['import_id']}/confirm", headers=auth(world.admin))).status_code == 200
    r = await client.post(f"/api/v1/admin/timetable/import/{b['import_id']}/confirm", headers=auth(world.admin))
    assert r.status_code == 409 and r.json()["error"]["code"] == "IMPORT_HAS_ERRORS" and await slot_count() == 1

from datetime import timedelta

from app.core.security import create_access_token
from tests.conftest import PASSWORD, auth

REG = dict(name="New Student", email="new@example.com", password="LongPassword-123", student_roll_no="21NEW0001", department="CSE", year=2)


async def test_register_creates_student_and_never_exposes_hash(client, world):
    r = await client.post("/api/v1/auth/register", json={**REG, "section_id": world.section.id})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["role"] == "STUDENT" and "password" not in body and "password_hash" not in body
    login = await client.post("/api/v1/auth/login", json={"email": REG["email"], "password": REG["password"]})
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {login.json()['access_token']}"})
    assert me.json()["section_id"] == world.section.id and me.json()["student_roll_no"] == "21NEW0001"


async def test_register_cannot_escalate_role(client, world):
    r = await client.post("/api/v1/auth/register", json={**REG, "role": "ADMIN"})
    assert r.status_code == 422 and r.json()["success"] is False


async def test_register_duplicate_email_409(client, world):
    r = await client.post("/api/v1/auth/register", json={**REG, "email": "stu1@example.com"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


async def test_login_success_and_invalid_password(client, world):
    ok = await client.post("/api/v1/auth/login", json={"email": "STU1@example.com", "password": PASSWORD})  # case-insensitive email
    assert ok.status_code == 200 and ok.json()["token_type"] == "bearer"
    bad = await client.post("/api/v1/auth/login", json={"email": "stu1@example.com", "password": "nope-nope-nope"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "INVALID_CREDENTIALS"
    unknown = await client.post("/api/v1/auth/login", json={"email": "ghost@example.com", "password": PASSWORD})
    assert unknown.status_code == 401 and unknown.json()["error"]["message"] == bad.json()["error"]["message"]


async def test_expired_token_rejected(client, world):
    token, _ = create_access_token(world.stu_user.id, "STUDENT", expires_delta=timedelta(seconds=-5))
    r = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "TOKEN_EXPIRED"


async def test_unauthorized_and_garbage_token(client, world):
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    r = await client.get("/api/v1/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert r.status_code == 401 and r.json()["error"]["code"] == "INVALID_TOKEN"


async def test_role_restriction(client, world):
    assert (await client.get("/api/v1/users", headers=auth(world.stu_user))).status_code == 403
    assert (await client.get("/api/v1/users", headers=auth(world.fac_user))).status_code == 403
    assert (await client.get("/api/v1/users", headers=auth(world.admin))).status_code == 200
    r = await client.post("/api/v1/rooms", headers=auth(world.stu_user),
                          json={"floor_id": world.floor1.id, "room_number": "X1", "capacity": 10})
    assert r.status_code == 403 and r.json()["error"]["code"] == "INSUFFICIENT_ROLE"


async def test_logout_revokes_token(client, world):
    h = auth(world.stu_user)
    assert (await client.get("/api/v1/auth/me", headers=h)).status_code == 200
    assert (await client.post("/api/v1/auth/logout", headers=h)).status_code == 200
    r = await client.get("/api/v1/auth/me", headers=h)
    assert r.status_code == 401 and r.json()["error"]["code"] == "TOKEN_REVOKED"


async def test_admin_creates_faculty_and_disabled_user_cannot_login(client, world):
    r = await client.post("/api/v1/users", headers=auth(world.admin), json={
        "name": "New Prof", "email": "np@example.com", "password": "LongPassword-123", "role": "FACULTY", "faculty_code": "F900", "department": "CSE"})
    assert r.status_code == 201 and r.json()["role"] == "FACULTY"
    uid = r.json()["id"]
    assert (await client.put(f"/api/v1/users/{uid}", headers=auth(world.admin), json={"is_active": False})).status_code == 200
    login = await client.post("/api/v1/auth/login", json={"email": "np@example.com", "password": "LongPassword-123"})
    assert login.status_code == 403 and login.json()["error"]["code"] == "ACCOUNT_DISABLED"
    assert (await client.put(f"/api/v1/users/{world.admin.id}", headers=auth(world.admin), json={"is_active": False})).status_code == 403

# FreeRoom — Smart Campus Room Availability & Allocation Platform

Backend for finding classrooms that are **genuinely** free. First deployment target: **VIT Chennai — AB3** (7 floors × 11 rooms = 77),
but nothing in the schema is AB3-specific (`buildings → floors → rooms`).

> **Room numbers are not invented.** AB3 is seeded with its building and 7 floors; the 77 real room numbers are loaded from a CSV you provide
> (see [Seeding](#11-seed-commands)). A separate clearly-labelled `DEMO` building provides sample data.

## 1. Overview
`AVAILABLE ROOM = ACTIVE ∧ STUDENT-ACCESSIBLE ∧ no timetable class ∧ no booking ∧ no maintenance ∧ no restriction ∧ no effective-schedule conflict`

## 2. Problem statement
Students with a free period cannot tell which rooms are really empty: timetables change (cancellations, one-off reschedules), rooms are
booked, repaired or restricted. FreeRoom computes the *effective* schedule and answers "is this room usable for this exact interval?" with
database-enforced guarantees against double booking.

## 3. Architecture
```
Client → FastAPI routers (api/) → Services (services/) → Repositories (repositories/) → SQLAlchemy 2 async → PostgreSQL
```
Routers only parse/authorize/serialize; business rules live in services; queries live in repositories. Key services:
`AvailabilityService` (single engine used by search, booking, rescheduling and analytics), `BookingService`, `ScheduleChangeService`,
`TimetableService` (+ free periods), `MaintenanceService/RestrictionService`, `TimetableImportService`, `RecommendationService`,
`AnalyticsService`, `NotificationService`, `AuditService`.

## 4. Technology stack
Python 3.12 · FastAPI · Uvicorn · Pydantic v2 + pydantic-settings · SQLAlchemy 2 (async) · asyncpg · Alembic · PostgreSQL 16 ·
PyJWT + Argon2 · pytest / pytest-asyncio / httpx. No SQLite, no Redis, no external APIs.

## 5. Database schema
Tables: `users, students, faculty, admins, buildings, floors, rooms, courses, sections, academic_periods, timetable_slots, schedule_changes,
room_bookings, room_maintenance, room_restrictions, notifications, audit_logs, revoked_tokens, timetable_imports`
(the last three, plus `admins`, `academic_periods`, `sections.code` are additions needed for logout, CSV staging, and configurable periods).

DB-level constraints: role/status/type `CHECK`s, `capacity > 0`, `start < end` on every interval, unique email / roll no / faculty code /
`(floor_id, room_number)` / floor per building, partial-unique indexes (one open exception per class occurrence; no duplicate active slot per
room/time), and the **`EXCLUDE USING gist` constraint on bookings** (see §17).

## 6. ER diagram (description)
```
buildings 1─* floors 1─* rooms
users 1─1 students | faculty | admins          sections 1─* students
courses, faculty, rooms, sections ─* timetable_slots (recurring weekly)
timetable_slots 1─* schedule_changes (one-off exceptions; new_room_id → rooms)
rooms 1─* room_bookings | room_maintenance | room_restrictions      users 1─* notifications, audit_logs
```

## 7. Setup
```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                  # then edit DATABASE_URL / JWT_SECRET
alembic upgrade head
python scripts/seed_database.py --admin-email you@example.com --admin-password 'a-long-password'
uvicorn app.main:app --reload                         # http://localhost:8000/docs
```

## 8. Environment variables
Required: `DATABASE_URL` (`postgresql+asyncpg://user:pass@host:5432/db`), `JWT_SECRET` (≥16 chars; use 32+ random), `JWT_ALGORITHM=HS256`,
`ACCESS_TOKEN_EXPIRE_MINUTES=30`, `FRONTEND_URL` (CORS origin), `ENVIRONMENT`.
Optional (defaults): `TIMEZONE=Asia/Kolkata`, `CAMPUS_DAY_START=08:00`, `CAMPUS_DAY_END=18:00` (used for *available_until* and utilization),
`WORKING_DAYS=[0,1,2,3,4]`, `BOOKING_MIN_MINUTES=15`, `BOOKING_MAX_MINUTES=240`, `BOOKING_MAX_ADVANCE_DAYS=14`, `RATE_LIMIT_ENABLED`, `RATE_LIMIT_PER_MINUTE`,
`REC_W_AVAILABILITY/CAPACITY/FACILITY/UTILIZATION/FLOOR` (recommendation weights). Generate a secret: `python -c "import secrets;print(secrets.token_urlsafe(48))"`.

## 9. PostgreSQL setup
```sql
CREATE USER freeroom WITH PASSWORD 'change-me';
CREATE DATABASE freeroom OWNER freeroom;
CREATE DATABASE freeroom_test OWNER freeroom;     -- for the test-suite
```
The first migration runs `CREATE EXTENSION btree_gist` (needed for the booking exclusion constraint; trusted extension on PG ≥ 13, otherwise run once as superuser).

## 10. Migrations
`alembic upgrade head` · `alembic downgrade base` · `alembic revision --autogenerate -m "msg"`. The initial migration creates the entire schema.

## 11. Seed commands
```bash
python scripts/seed_database.py                                   # AB3 + 7 floors + default period grid (0 rooms until you supply numbers)
python scripts/seed_database.py --rooms-file ab3_rooms.csv        # real room numbers
python scripts/seed_database.py --demo --demo-password '...'      # demo users/timetable/booking/maintenance in building DEMO
```
**Supplying the 77 AB3 room numbers**: edit `app/seed/ab3_rooms.csv` (columns `floor_number,room_number`; exactly 11 per floor, unique). The loader refuses
anything other than 7×11 unless `--allow-partial`, and is idempotent. Every AB3 room gets capacity 70, CLASSROOM, no AC, projector, student-accessible, ACTIVE.
Demo logins: `admin@freeroom.example`, `faculty1@…`, `student1@…` (password = `--demo-password`). **Never use `--demo` in production.**
Period grid: a sample 50-minute grid (08:00–15:30) is inserted only if `academic_periods` is empty — replace it via `PUT /api/v1/timetable/periods`.

## 12. API documentation
Interactive docs: `/docs` (Swagger), `/redoc`, `/openapi.json`. All endpoints are under `/api/v1`. Highlights:

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` `POST /auth/login` `GET /auth/me` `POST /auth/logout` |
| Availability | `GET /availability` · `GET /availability/break` · `GET /availability/rooms/{id}` (reasons) · `GET /availability/recommendations` |
| Timetable | `GET /timetable/me` · `GET /timetable/free-periods` · `GET/PUT /timetable/periods` · `GET/POST/PUT/DELETE /timetable/slots` |
| Bookings | `POST/GET /bookings` · `GET/DELETE /bookings/{id}` |
| Schedule changes | `POST /schedule-changes` · `POST /schedule-changes/cancel-occurrence` · `PUT /{id}/approve` · `PUT /{id}/reject` · `DELETE /{id}` (withdraw) |
| Rooms | `GET/POST /rooms` · `GET/PUT/DELETE /rooms/{id}` · `GET /buildings` |
| Maintenance / Restrictions | `POST/GET/PUT/DELETE /maintenance` · `POST/GET/DELETE /restrictions` |
| Admin | `/admin/analytics/{rooms,bookings,utilization}` · `/admin/audit-logs` · `POST /admin/timetable/import` (+`/{id}/confirm`) · buildings/floors/courses/sections |

Datetimes: ISO-8601 **with offset**; naive values are rejected (422). In query strings URL-encode `+` as `%2B`. Errors: `{"success":false,"error":{"code","message","details"}}`
with 400/401/403/404/409/422/429/500. Lists use `?page=&page_size=` (max 100).

## 13. Authentication flow
`register` (STUDENT only; unknown fields such as `role` → 422) → `login` returns a JWT (HS256, 30 min, `jti`) → send `Authorization: Bearer …`.
The user's role/active flag is **re-read from the database on every request** (never trusted from the token). `logout` stores the `jti` in `revoked_tokens`.
Faculty/admin accounts are created by an admin (`POST /users`) or the seed script. Passwords: Argon2id. Auth endpoints are rate-limited (in-process; swap for Redis if you run several workers).

## 14. Availability algorithm
1. Candidate rooms = ACTIVE rooms matching filters (students: `student_accessible` only).
2. **Effective schedule** for the window = recurring `timetable_slots` for the weekdays involved − occurrences that have an APPROVED `schedule_changes` row
   (moved/cancelled) + APPROVED changes whose *new* date/time/room fall in the window.
3. Blockers for all candidates loaded in 4 queries: effective class occurrences, PENDING/CONFIRMED bookings, SCHEDULED/IN_PROGRESS maintenance, ACTIVE restrictions.
4. A blocker conflicts when `existing_start < requested_end AND existing_end > requested_start` (half-open: back-to-back intervals are fine).
5. `available_until` = start of the next blocker after the request (or campus closing time).
`/availability/break` additionally reports whether the *student* has class in that interval. **Free periods**: each configured period is `CLASS` if any effective
class of the student's section overlaps it, otherwise `FREE`; consecutive free periods are merged into `free_intervals`.

## 15. Booking transaction design
```
BEGIN
  SELECT … FROM rooms WHERE id = :room FOR UPDATE      -- serialise attempts on this room
  availability re-check (class / exception / maintenance / restriction / booking)
  INSERT room_bookings  (+ notification + audit_log)
COMMIT                                                 -- any exception → ROLLBACK, nothing persisted
```

## 16. Rescheduling architecture
The recurring slot is never edited. Faculty `POST /schedule-changes` (validated: ownership, new room exists/free, no class/booking/maintenance/restriction clash,
no faculty or section clash; the occurrence being moved is excluded from its own conflict check) → `PENDING`, admins notified. Admin `approve`:
re-validates under a room lock (state may have changed), sets `APPROVED`, notifies the faculty and every student of the section, writes audit — the effective
schedule changes immediately (old room freed, new room occupied). `reject` stores the decision and notifies faculty. Cancelling one occurrence creates an
`APPROVED CANCELLED` exception (immediate); `DELETE /schedule-changes/{id}` reverts it. Admin-created requests are auto-approved.

## 17. Concurrency strategy
Two layers: (1) **row lock** on the room (`SELECT … FOR UPDATE`) taken by booking, maintenance, restriction and reschedule-approval — this serialises the
check-then-insert for *non-booking* conflicts (class/maintenance/restriction) that no constraint can express; (2) a PostgreSQL **exclusion constraint**
`EXCLUDE USING gist (room_id WITH =, tstzrange(start_datetime,end_datetime,'[)') WITH &&) WHERE status IN ('PENDING','CONFIRMED')` makes overlapping
active bookings *impossible* even if application code is bypassed. `READ COMMITTED` suffices because the lock serialises writers. Timetable writes (slot create/update/import)
take a transaction-level advisory lock. The test-suite fires 15 simultaneous requests at one room/time: exactly one succeeds.
Side effects: maintenance/restriction/new-class/room-deactivation **cancel** overlapping future bookings and notify their owners.

## 18. Testing
```bash
createdb freeroom_test        # or see §9
pytest                         # 67 tests; runs `alembic upgrade head` on freeroom_test first (override with TEST_DATABASE_URL)
```
Tests hit a real PostgreSQL (CHECK/EXCLUDE constraints and concurrency are real): auth, availability, booking (incl. concurrent), rescheduling & exceptions,
CSV import, admin/rooms/analytics, recommendations, error format.

## 19. Deployment
```bash
cp .env.example .env     # set JWT_SECRET (and POSTGRES_PASSWORD)
docker compose up --build        # PostgreSQL 16 + API on :8000; migrations run on start
docker compose exec api python scripts/seed_database.py --admin-email you@example.com --admin-password '…'
```
Production checklist: strong `JWT_SECRET`, `ENVIRONMENT=production`, HTTPS termination in front, `FRONTEND_URL` set to the real origin, DB backups,
run `uvicorn` with several workers (then move the rate limiter to Redis), purge old `revoked_tokens` (done opportunistically on logout).

## 20. Design decisions, limitations & future work
* **Time**: `timestamptz` everywhere; timetable wall-clock `time` columns are interpreted in `Asia/Kolkata`; API outputs are rendered in that zone; naive input is rejected.
* **Day of week** is `0=Monday … 6=Sunday`. Recurring slots have no term start/end dates — deactivate slots (`is_active`) when a semester ends.
* Section clashes are treated as errors (electives/lab batches that legitimately overlap would need a batch/group column).
* A confirmed booking is created directly as `CONFIRMED`; `PENDING`/`EXPIRED` are reserved for a future approval flow.
* Room-number uniqueness *per building* is checked in the service (DB enforces per floor).
* Future: Redis rate-limit, email/push notifications, recurring bookings, per-user booking quotas, refresh tokens, OpenTelemetry, frontend (React).

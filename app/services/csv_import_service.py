import csv
import io
from datetime import datetime, time
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.exceptions import ConflictError, NotFoundError, ValidationAppError
from app.models import Course, Faculty, Room, Section, TimetableImport, TimetableSlot, User
from app.models.enums import ImportStatus, RoomStatus
from app.repositories.timetable_repository import TimetableRepository
from app.schemas.timetable import ImportCommitResult, ImportPreview
from app.services.audit_service import AuditService
from app.services.timetable_service import SlotKey, TimetableService, find_slot_conflicts, slot_key
from app.utils.datetime_utils import now

REQUIRED_COLUMNS = ["course_code", "faculty", "room", "day", "period", "start_time", "end_time", "section", "academic_year", "semester"]
DAYS = {"MON": 0, "MONDAY": 0, "TUE": 1, "TUES": 1, "TUESDAY": 1, "WED": 2, "WEDNESDAY": 2, "THU": 3, "THUR": 3, "THURS": 3,
        "THURSDAY": 3, "FRI": 4, "FRIDAY": 4, "SAT": 5, "SATURDAY": 5, "SUN": 6, "SUNDAY": 6}
ALLOWED_TYPES = {"text/csv", "application/csv", "application/vnd.ms-excel", "text/plain", "application/octet-stream", None, ""}


def _time(v: str) -> time:
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(v.strip(), fmt).time()
        except ValueError:
            pass
    raise ValueError(v)


class TimetableImportService:
    """Two-step import:  upload -> validated preview (nothing written to timetable_slots)
                         confirm -> re-validate against current DB state, insert atomically."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = TimetableRepository(session)
        self.audit = AuditService(session)

    # ---- parsing ------------------------------------------------------------------------------------
    @staticmethod
    def parse_csv(filename: str, content_type: str | None, raw: bytes) -> list[dict[str, str]]:
        if not filename.lower().endswith(".csv") or content_type not in ALLOWED_TYPES:
            raise ValidationAppError("Only .csv files are accepted.", code="INVALID_FILE_TYPE")
        if len(raw) > settings.MAX_IMPORT_BYTES:
            raise ValidationAppError("File too large.", code="FILE_TOO_LARGE")
        if b"\x00" in raw:
            raise ValidationAppError("File is not a text CSV.", code="INVALID_FILE_TYPE")
        try:
            text = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise ValidationAppError("File must be UTF-8 encoded.", code="INVALID_ENCODING")
        reader = csv.DictReader(io.StringIO(text))
        header = [h.strip().lower() for h in (reader.fieldnames or [])]
        missing = [c for c in REQUIRED_COLUMNS if c not in header]
        if missing:
            raise ValidationAppError(f"Missing required column(s): {', '.join(missing)}.", code="MISSING_COLUMNS",
                                     details={"missing": missing, "required": REQUIRED_COLUMNS})
        rows = [{(k or "").strip().lower(): (v or "").strip() for k, v in r.items()} for r in reader]
        if not rows:
            raise ValidationAppError("CSV contains no data rows.", code="EMPTY_FILE")
        if len(rows) > settings.MAX_IMPORT_ROWS:
            raise ValidationAppError(f"At most {settings.MAX_IMPORT_ROWS} rows per import.", code="TOO_MANY_ROWS")
        return rows

    # ---- validation ---------------------------------------------------------------------------------
    async def validate(self, rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        courses = {c.course_code.upper(): c for c in (await self.session.execute(select(Course))).scalars()}
        faculty = {f.faculty_code.upper(): f for f in (await self.session.execute(select(Faculty))).scalars().unique()}
        rooms = {r.display_name.upper(): r for r in (await self.session.execute(select(Room))).scalars().unique()}
        sections = {(s.code.upper(), s.academic_year, s.semester): s for s in (await self.session.execute(select(Section))).scalars()}
        terms = {(r["academic_year"], r["semester"]) for r in rows}
        pool: list[SlotKey] = [slot_key(s) for s in await self.repo.active_slots_for_terms(terms)]

        valid: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        for i, r in enumerate(rows):
            n = i + 2  # spreadsheet row number (header = row 1)
            errs: list[tuple[str, str, str]] = []
            course = courses.get(r["course_code"].upper())
            if not course:
                errs.append(("course_code", "COURSE_NOT_FOUND", f"Unknown course '{r['course_code']}'."))
            elif not course.is_active:
                errs.append(("course_code", "COURSE_INACTIVE", f"Course '{r['course_code']}' is inactive."))
            fac = faculty.get(r["faculty"].upper())
            if not fac:
                errs.append(("faculty", "FACULTY_NOT_FOUND", f"Unknown faculty code '{r['faculty']}'."))
            room = rooms.get(r["room"].upper())
            if not room:
                errs.append(("room", "ROOM_NOT_FOUND", f"Unknown room '{r['room']}' (expected format BUILDING-NUMBER, e.g. AB3-304)."))
            elif room.status != RoomStatus.ACTIVE.value:
                errs.append(("room", "ROOM_INACTIVE", f"Room '{r['room']}' is inactive."))
            sec = sections.get((r["section"].upper(), r["academic_year"], r["semester"]))
            if not r["academic_year"] or not r["semester"]:
                errs.append(("academic_year", "MISSING_VALUE", "academic_year and semester are required."))
            elif not sec:
                errs.append(("section", "SECTION_NOT_FOUND", f"Unknown section '{r['section']}' for {r['academic_year']} / {r['semester']}."))
            day = DAYS.get(r["day"].upper())
            if day is None:
                errs.append(("day", "INVALID_DAY", f"Invalid day '{r['day']}'."))
            try:
                period = int(r["period"])
                if period <= 0:
                    raise ValueError
            except ValueError:
                period = 0
                errs.append(("period", "INVALID_PERIOD", f"Invalid period '{r['period']}'."))
            st = et = None
            try:
                st = _time(r["start_time"])
            except ValueError:
                errs.append(("start_time", "INVALID_TIME", f"Invalid start_time '{r['start_time']}' (use HH:MM)."))
            try:
                et = _time(r["end_time"])
            except ValueError:
                errs.append(("end_time", "INVALID_TIME", f"Invalid end_time '{r['end_time']}' (use HH:MM)."))
            if st and et and st >= et:
                errs.append(("end_time", "TIME_ORDER", "start_time must be before end_time."))
            if errs:
                errors += [{"row": n, "field": f, "code": c, "message": m} for f, c, m in errs]
                continue
            key = SlotKey(None, course.id, fac.id, room.id, sec.id, day, st, et, r["academic_year"], r["semester"])
            conflicts = find_slot_conflicts(key, pool)
            if conflicts:
                errors += [{"row": n, "field": None, "code": c, "message": m} for c, m in dict.fromkeys(conflicts)]
                continue
            pool.append(key)  # later rows are checked against earlier accepted rows too
            valid.append({"row": n, "course_id": course.id, "faculty_id": fac.id, "room_id": room.id, "section_id": sec.id,
                          "day_of_week": day, "period_number": period, "start_time": st, "end_time": et,
                          "academic_year": r["academic_year"], "semester": r["semester"]})
        return valid, errors

    # ---- step 1: preview ----------------------------------------------------------------------------
    async def preview(self, actor: User, filename: str, content_type: str | None, raw: bytes) -> ImportPreview:
        rows = self.parse_csv(filename, content_type, raw)
        valid, errors = await self.validate(rows)
        rec = TimetableImport(uploaded_by=actor.id, filename=filename[:255], total_rows=len(rows), raw_rows=rows, errors=errors)
        self.session.add(rec)
        await self.session.flush()
        self.audit.record(actor.id, "TIMETABLE_IMPORT_PREVIEWED", "timetable_import", rec.id, None,
                          {"filename": filename, "rows": len(rows), "errors": len(errors)})
        await self.session.commit()
        return ImportPreview(import_id=rec.id, filename=filename, total_rows=len(rows), valid_rows=len(valid),
                             error_count=len(errors), errors=errors[:500], can_commit=bool(valid) and not errors)

    # ---- step 2: confirm ----------------------------------------------------------------------------
    async def confirm(self, actor: User, import_id: int, allow_partial: bool = False) -> ImportCommitResult:
        ts = TimetableService(self.session)
        await ts._lock()  # serialise with every other timetable writer
        rec = (await self.session.execute(select(TimetableImport).where(TimetableImport.id == import_id).with_for_update())).scalar_one_or_none()
        if not rec:
            raise NotFoundError("Import not found.")
        if rec.status != ImportStatus.PENDING.value:
            raise ConflictError(f"Import already {rec.status}.", code="INVALID_STATE")
        valid, errors = await self.validate(rec.raw_rows)  # state may have changed since the preview
        if errors and not allow_partial:
            raise ConflictError(f"{len(errors)} validation error(s). Fix the file or confirm with allow_partial=true.",
                                code="IMPORT_HAS_ERRORS", details=errors[:100])
        if not valid:
            raise ConflictError("No valid rows to import.", code="NOTHING_TO_IMPORT")
        slots = [TimetableSlot(**{k: v for k, v in v_.items() if k != "row"}) for v_ in valid]
        self.session.add_all(slots)
        await self.session.flush()
        released = await ts.release_bookings_for_new_classes(actor, slots)
        rec.status, rec.committed_at, rec.errors = ImportStatus.COMMITTED.value, now(), errors
        self.audit.record(actor.id, "TIMETABLE_IMPORT_COMMITTED", "timetable_import", rec.id, None,
                          {"inserted": len(slots), "skipped": len(errors), "bookings_cancelled": released})
        await self.session.commit()  # one transaction: all valid rows or none
        return ImportCommitResult(import_id=rec.id, inserted=len(slots), skipped=len({e["row"] for e in errors}), status=rec.status)

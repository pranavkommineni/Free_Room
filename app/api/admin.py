from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.dependencies import AdminUser, DbSession
from app.core.exceptions import ConflictError
from app.models import Course, Section
from app.schemas.analytics import AuditLogOut, BookingAnalytics, RoomAnalytics, UtilizationAnalytics
from app.schemas.common import Page
from app.schemas.room import BuildingCreate, BuildingOut, FloorCreate, FloorOut
from app.schemas.timetable import ImportCommitResult, ImportPreview
from app.schemas.user import CourseCreate, CourseOut, SectionCreate, SectionOut
from app.services.analytics_service import AnalyticsService
from app.services.audit_service import AuditService
from app.services.csv_import_service import TimetableImportService
from app.services.room_service import RoomService
from app.utils.pagination import PageParams, paginate

router = APIRouter(prefix="/admin", tags=["Admin"])


# ---- analytics ---------------------------------------------------------------------------------------------
@router.get("/analytics/rooms", response_model=RoomAnalytics, summary="Room counts and live availability")
async def analytics_rooms(admin: AdminUser, session: DbSession):
    return await AnalyticsService(session).rooms(admin)


@router.get("/analytics/bookings", response_model=BookingAnalytics, summary="Booking / cancellation statistics")
async def analytics_bookings(admin: AdminUser, session: DbSession, start_datetime: AwareDatetime | None = None,
                             end_datetime: AwareDatetime | None = None):
    return await AnalyticsService(session).bookings(start_datetime, end_datetime)


@router.get("/analytics/utilization", response_model=UtilizationAnalytics,
            summary="Per-room utilization (booked hours + effective class hours), most/least used")
async def analytics_utilization(admin: AdminUser, session: DbSession, start_datetime: AwareDatetime | None = None,
                                end_datetime: AwareDatetime | None = None, top_n: int = Query(5, ge=1, le=50)):
    return await AnalyticsService(session).utilization(start_datetime, end_datetime, top_n)


@router.get("/audit-logs", response_model=Page[AuditLogOut], summary="Audit trail")
async def audit_logs(admin: AdminUser, session: DbSession, params: PageParams = Depends(), entity_type: str | None = None,
                     user_id: int | None = None, action: str | None = None):
    items, total = await AuditService(session).list(params, entity_type, user_id, action)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


# ---- CSV timetable import -----------------------------------------------------------------------------------
@router.post("/timetable/import", response_model=ImportPreview, summary="Upload a timetable CSV -> validation preview (nothing is committed)",
             description="Columns: course_code, faculty (faculty_code), room (e.g. AB3-304), day (MON..SUN), period, start_time, end_time, "
                         "section (section code), academic_year, semester. Review the report, then call "
                         "`POST /admin/timetable/import/{import_id}/confirm`.")
async def import_preview(admin: AdminUser, session: DbSession, file: Annotated[UploadFile, File(description="CSV file")]):
    raw = await file.read(2_000_001)
    return await TimetableImportService(session).preview(admin, file.filename or "upload.csv", file.content_type, raw)


@router.post("/timetable/import/{import_id}/confirm", response_model=ImportCommitResult,
             summary="Confirm an import: re-validates and commits atomically",
             description="Fails with 409 IMPORT_HAS_ERRORS unless the file is fully valid, or `allow_partial=true` is passed to "
                         "commit only the valid rows.")
async def import_confirm(import_id: int, admin: AdminUser, session: DbSession, allow_partial: bool = False):
    return await TimetableImportService(session).confirm(admin, import_id, allow_partial)


# ---- reference data -------------------------------------------------------------------------------------------
@router.post("/buildings", response_model=BuildingOut, status_code=status.HTTP_201_CREATED)
async def create_building(data: BuildingCreate, admin: AdminUser, session: DbSession):
    b = await RoomService(session).create_building(admin, data)
    return BuildingOut(id=b.id, name=b.name, code=b.code)


@router.post("/buildings/{building_id}/floors", response_model=FloorOut, status_code=status.HTTP_201_CREATED)
async def create_floor(building_id: int, data: FloorCreate, admin: AdminUser, session: DbSession):
    return await RoomService(session).create_floor(admin, building_id, data)


@router.get("/courses", response_model=Page[CourseOut])
async def list_courses(admin: AdminUser, session: DbSession, params: PageParams = Depends()):
    items, total = await paginate(session, select(Course).order_by(Course.course_code), params)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("/courses", response_model=CourseOut, status_code=status.HTTP_201_CREATED)
async def create_course(data: CourseCreate, admin: AdminUser, session: DbSession):
    c = Course(course_code=data.course_code.upper(), course_name=data.course_name, department=data.department,
               credits=data.credits)
    session.add(c)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Course code already exists.", code="COURSE_ALREADY_EXISTS")
    AuditService(session).record(admin.id, "COURSE_CREATED", "course", c.id, None, {"course_code": c.course_code})
    await session.commit()
    return c


@router.get("/sections", response_model=Page[SectionOut])
async def list_sections(admin: AdminUser, session: DbSession, params: PageParams = Depends()):
    items, total = await paginate(session, select(Section).order_by(Section.code), params)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("/sections", response_model=SectionOut, status_code=status.HTTP_201_CREATED)
async def create_section(data: SectionCreate, admin: AdminUser, session: DbSession):
    s = Section(**data.model_dump())
    session.add(s)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ConflictError("Section already exists for this term.", code="SECTION_ALREADY_EXISTS")
    AuditService(session).record(admin.id, "SECTION_CREATED", "section", s.id, None, {"code": s.code})
    await session.commit()
    return s

from datetime import date

from fastapi import APIRouter, Depends, Query, status

from app.core.dependencies import AdminUser, CurrentUser, DbSession, FacultyOrAdmin
from app.repositories.timetable_repository import TimetableRepository
from app.schemas.common import Page
from app.schemas.timetable import (FreePeriodsResponse, OccurrenceOut, PeriodCreate, PeriodOut, SlotCreate, SlotOut, SlotUpdate)
from app.services.timetable_service import TimetableService
from app.utils.datetime_utils import now
from app.utils.pagination import PageParams

router = APIRouter(prefix="/timetable", tags=["Timetable"])


@router.get("/me", response_model=list[OccurrenceOut],
            summary="My effective timetable (students by section, faculty by teaching) incl. approved exceptions")
async def my_timetable(user: CurrentUser, session: DbSession, from_date: date | None = None, to_date: date | None = None):
    first = from_date or now().date()
    return await TimetableService(session).my_schedule(user, first, to_date or first)


@router.get("/free-periods", response_model=FreePeriodsResponse, summary="Free-period detection for a student on a date",
            description="Each configured academic period is CLASS or FREE based on the student's effective schedule.")
async def free_periods(user: CurrentUser, session: DbSession, date_: date = Query(alias="date"), student_id: int | None = None):
    return await TimetableService(session).free_periods(user, student_id, date_)


@router.get("/periods", response_model=list[PeriodOut], summary="Configured period grid")
async def list_periods(user: CurrentUser, session: DbSession):
    return await TimetableRepository(session).periods()


@router.put("/periods", response_model=PeriodOut, summary="Create/update a period boundary (ADMIN)")
async def upsert_period(data: PeriodCreate, admin: AdminUser, session: DbSession):
    return await TimetableService(session).upsert_period(admin, data)


@router.get("/slots", response_model=Page[SlotOut], summary="Recurring timetable slots (faculty see only their own)")
async def list_slots(user: FacultyOrAdmin, session: DbSession, params: PageParams = Depends(), room_id: int | None = None,
                     faculty_id: int | None = None, section_id: int | None = None, day_of_week: int | None = Query(None, ge=0, le=6),
                     active_only: bool = True):
    items, total = await TimetableService(session).list_slots(user, params, room_id=room_id, faculty_id=faculty_id,
                                                              section_id=section_id, day_of_week=day_of_week, active_only=active_only)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.post("/slots", response_model=SlotOut, status_code=status.HTTP_201_CREATED, summary="Create a recurring slot (ADMIN)")
async def create_slot(data: SlotCreate, admin: AdminUser, session: DbSession):
    return await TimetableService(session).create_slot(admin, data)


@router.put("/slots/{slot_id}", response_model=SlotOut, summary="Edit the RECURRING slot (ADMIN). One-off changes use /schedule-changes")
async def update_slot(slot_id: int, data: SlotUpdate, admin: AdminUser, session: DbSession):
    return await TimetableService(session).update_slot(admin, slot_id, data)


@router.delete("/slots/{slot_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Deactivate a slot (ADMIN, soft delete)")
async def delete_slot(slot_id: int, admin: AdminUser, session: DbSession):
    await TimetableService(session).deactivate_slot(admin, slot_id)

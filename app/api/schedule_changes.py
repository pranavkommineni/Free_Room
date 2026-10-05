from fastapi import APIRouter, Depends, status

from app.core.dependencies import AdminUser, CurrentUser, DbSession, FacultyOrAdmin
from app.schemas.common import Page
from app.schemas.schedule_change import CancelOccurrence, Decision, ScheduleChangeCreate, ScheduleChangeOut
from app.services.schedule_change_service import ScheduleChangeService
from app.utils.pagination import PageParams

router = APIRouter(prefix="/schedule-changes", tags=["Schedule changes"])


@router.post("", response_model=ScheduleChangeOut, status_code=status.HTTP_201_CREATED,
             summary="Request a one-off reschedule / room change / time change (FACULTY owner or ADMIN)",
             description="The recurring timetable is never modified. The request is validated (ownership, room, class/booking/"
                         "maintenance/restriction conflicts, faculty & section clashes) and stored as PENDING; admins are notified. "
                         "Admin-created requests are auto-approved.")
async def request_change(data: ScheduleChangeCreate, user: FacultyOrAdmin, session: DbSession):
    return await ScheduleChangeService(session).request_change(user, data)


@router.post("/cancel-occurrence", response_model=ScheduleChangeOut, status_code=status.HTTP_201_CREATED,
             summary="Cancel ONE occurrence of a class (FACULTY owner or ADMIN) - takes effect immediately")
async def cancel_occurrence(data: CancelOccurrence, user: FacultyOrAdmin, session: DbSession):
    return await ScheduleChangeService(session).cancel_occurrence(user, data)


@router.get("", response_model=Page[ScheduleChangeOut], summary="List changes (faculty: own; admin: all)")
async def list_changes(user: FacultyOrAdmin, session: DbSession, params: PageParams = Depends(), status: str | None = None,
                       timetable_slot_id: int | None = None):
    items, total = await ScheduleChangeService(session).list(user, params, status, timetable_slot_id)
    return Page(items=items, total=total, page=params.page, page_size=params.page_size)


@router.get("/{change_id}", response_model=ScheduleChangeOut)
async def get_change(change_id: int, user: FacultyOrAdmin, session: DbSession):
    return await ScheduleChangeService(session).get(user, change_id)


@router.put("/{change_id}/approve", response_model=ScheduleChangeOut, summary="Approve (ADMIN)")
async def approve(change_id: int, admin: AdminUser, session: DbSession, body: Decision | None = None):
    return await ScheduleChangeService(session).approve(admin, change_id, body.note if body else None)


@router.put("/{change_id}/reject", response_model=ScheduleChangeOut, summary="Reject (ADMIN)")
async def reject(change_id: int, admin: AdminUser, session: DbSession, body: Decision | None = None):
    return await ScheduleChangeService(session).reject(admin, change_id, body.note if body else None)


@router.delete("/{change_id}", response_model=ScheduleChangeOut,
               summary="Withdraw a pending change / revert an approved one (requester or ADMIN)")
async def withdraw(change_id: int, user: FacultyOrAdmin, session: DbSession):
    return await ScheduleChangeService(session).withdraw(user, change_id)

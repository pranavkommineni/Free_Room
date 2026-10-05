from datetime import date, time

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError, ValidationAppError
from app.models import ScheduleChange, TimetableSlot, User
from app.models.enums import ChangeStatus, ChangeType, NotificationType, Role
from app.repositories.room_repository import RoomRepository
from app.repositories.schedule_repository import ScheduleRepository
from app.repositories.timetable_repository import OccurrenceKey, TimetableRepository
from app.repositories.user_repository import UserRepository
from app.schemas.schedule_change import CancelOccurrence, ScheduleChangeCreate
from app.services.audit_service import CHANGE_FIELDS, AuditService, snapshot
from app.services.availability_service import AvailabilityService
from app.services.notification_service import NotificationService
from app.utils.datetime_utils import combine, now
from app.utils.pagination import PageParams, paginate


class ScheduleChangeService:
    """One-off timetable exceptions. The recurring TimetableSlot is NEVER modified; the effective schedule
    (TimetableRepository.effective_occurrences) overlays APPROVED rows from schedule_changes."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ScheduleRepository(session)
        self.timetable = TimetableRepository(session)
        self.rooms = RoomRepository(session)
        self.users = UserRepository(session)
        self.availability = AvailabilityService(session)
        self.notifications = NotificationService(session)
        self.audit = AuditService(session)

    # ---- helpers ----------------------------------------------------------------------------------
    async def _authorised_slot(self, user: User, slot_id: int) -> TimetableSlot:
        slot = await self.timetable.get_slot(slot_id)
        if not slot:
            raise NotFoundError("Timetable slot not found.", code="SLOT_NOT_FOUND")
        if user.role == Role.FACULTY.value:
            f = await self.users.faculty_by_user(user.id)
            if not f or f.id != slot.faculty_id:
                raise ForbiddenError("You can only change your own classes.", code="NOT_SLOT_OWNER")
        elif user.role != Role.ADMIN.value:
            raise ForbiddenError("Only faculty or admins can change the schedule.")
        if not slot.is_active:
            raise ConflictError("Timetable slot is inactive.", code="SLOT_INACTIVE")
        return slot

    @staticmethod
    def _check_occurrence(slot: TimetableSlot, original_date: date) -> None:
        if original_date.weekday() != slot.day_of_week:
            raise ValidationAppError("original_date is not a scheduled day for this timetable slot.", code="NO_SUCH_OCCURRENCE")
        if combine(original_date, slot.end_time) <= now():
            raise ValidationAppError("That occurrence has already taken place.", code="OCCURRENCE_IN_PAST")

    async def _assert_party_free(self, slot: TimetableSlot, start, end, exclude: set[OccurrenceKey]) -> None:
        """Faculty and section must not have another class in the new interval."""
        if await self.timetable.effective_occurrences(start, end, faculty_id=slot.faculty_id, exclude=exclude):
            raise ConflictError("The faculty member has another class at the requested time.", code="FACULTY_CONFLICT")
        if await self.timetable.effective_occurrences(start, end, section_id=slot.section_id, exclude=exclude):
            raise ConflictError("The section has another class at the requested time.", code="SECTION_CONFLICT")

    async def _validate_target(self, actor: User, slot: TimetableSlot, change: ScheduleChange) -> None:
        """Lock target room, then make sure the new placement is genuinely free (re-run at approval time)."""
        room = await self.rooms.get_for_update(change.new_room_id)  # type: ignore[arg-type]
        if not room:
            raise NotFoundError("New room not found.", code="ROOM_NOT_FOUND")
        start, end = combine(change.new_date, change.new_start_time), combine(change.new_date, change.new_end_time)  # type: ignore[arg-type]
        if end <= now():
            raise ValidationAppError("The new time is in the past.", code="NEW_TIME_IN_PAST")
        exclude = {(slot.id, change.original_date)}
        await self.availability.assert_available(room, start, end, actor, exclude_occurrences=exclude)
        await self._assert_party_free(slot, start, end, exclude)

    async def _notify_students(self, slot: TimetableSlot, type_: NotificationType, title: str, message: str) -> None:
        self.notifications.notify_many(await self.users.student_user_ids_in_section(slot.section_id), type_, title, message)

    def _describe(self, c: ScheduleChange, slot: TimetableSlot) -> str:
        return (f"{slot.course.course_code} on {c.original_date:%d %b} ({c.original_start_time:%H:%M}) -> "
                f"{c.new_date:%d %b} {c.new_start_time:%H:%M}-{c.new_end_time:%H:%M}")

    # ---- faculty: request ------------------------------------------------------------------------
    async def request_change(self, user: User, data: ScheduleChangeCreate) -> ScheduleChange:
        slot = await self._authorised_slot(user, data.timetable_slot_id)
        self._check_occurrence(slot, data.original_date)
        if await self.repo.open_for_occurrence(slot.id, data.original_date):
            raise ConflictError("A pending or approved change already exists for this occurrence.", code="CHANGE_ALREADY_EXISTS")
        change = ScheduleChange(
            timetable_slot_id=slot.id, original_date=data.original_date, original_room_id=slot.room_id,
            original_start_time=slot.start_time, original_end_time=slot.end_time,
            new_date=data.new_date or data.original_date, new_room_id=data.new_room_id or slot.room_id,
            new_start_time=data.new_start_time or slot.start_time, new_end_time=data.new_end_time or slot.end_time,
            change_type=data.change_type.value, reason=data.reason, requested_by=user.id, status=ChangeStatus.PENDING.value)
        await self._validate_target(user, slot, change)
        self.session.add(change)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("A pending or approved change already exists for this occurrence.", code="CHANGE_ALREADY_EXISTS")
        self.audit.record(user.id, "SCHEDULE_CHANGE_REQUESTED", "schedule_change", change.id, None, snapshot(change, CHANGE_FIELDS))
        if user.role == Role.ADMIN.value:  # admins are the approvers: auto-approve their own requests
            self._apply_approval(user, change)
            await self._after_approval(user, slot, change)
        else:
            self.notifications.notify_many(await self.users.admin_user_ids(), NotificationType.RESCHEDULE_REQUESTED,
                                           "Reschedule request", f"{user.name} requested: {self._describe(change, slot)}")
        await self.session.commit()
        return change

    # ---- admin: approve / reject -----------------------------------------------------------------
    def _apply_approval(self, admin: User, change: ScheduleChange) -> None:
        change.status = ChangeStatus.APPROVED.value
        change.approved_by = admin.id
        change.approved_at = now()

    async def _after_approval(self, admin: User, slot: TimetableSlot, change: ScheduleChange) -> None:
        desc = self._describe(change, slot)
        if change.requested_by != admin.id:
            self.notifications.notify(change.requested_by, NotificationType.RESCHEDULE_APPROVED, "Reschedule approved", desc)
        await self._notify_students(slot, NotificationType.CLASS_RESCHEDULED, "Class rescheduled", desc)
        self.audit.record(admin.id, "SCHEDULE_CHANGE_APPROVED", "schedule_change", change.id, None, snapshot(change, CHANGE_FIELDS))

    async def approve(self, admin: User, change_id: int, note: str | None) -> ScheduleChange:
        change = await self.repo.get_for_update(change_id)
        if not change:
            raise NotFoundError("Schedule change not found.")
        if change.status != ChangeStatus.PENDING.value:
            raise ConflictError(f"Only PENDING requests can be approved (current: {change.status}).", code="INVALID_STATE")
        slot = change.slot
        await self._validate_target(admin, slot, change)  # state may have changed since the request
        change.decision_note = note
        self._apply_approval(admin, change)
        await self._after_approval(admin, slot, change)
        await self.session.commit()
        return change

    async def reject(self, admin: User, change_id: int, note: str | None) -> ScheduleChange:
        change = await self.repo.get_for_update(change_id)
        if not change:
            raise NotFoundError("Schedule change not found.")
        if change.status != ChangeStatus.PENDING.value:
            raise ConflictError(f"Only PENDING requests can be rejected (current: {change.status}).", code="INVALID_STATE")
        change.status, change.rejected_at, change.decision_note, change.approved_by = (
            ChangeStatus.REJECTED.value, now(), note, admin.id)
        self.notifications.notify(change.requested_by, NotificationType.RESCHEDULE_REJECTED, "Reschedule rejected",
                                  f"{self._describe(change, change.slot)}" + (f" - {note}" if note else ""))
        self.audit.record(admin.id, "SCHEDULE_CHANGE_REJECTED", "schedule_change", change.id, None, snapshot(change, CHANGE_FIELDS))
        await self.session.commit()
        return change

    # ---- cancel a single occurrence ------------------------------------------------------------------
    async def cancel_occurrence(self, user: User, data: CancelOccurrence) -> ScheduleChange:
        slot = await self._authorised_slot(user, data.timetable_slot_id)
        self._check_occurrence(slot, data.original_date)
        if await self.repo.open_for_occurrence(slot.id, data.original_date):
            raise ConflictError("A pending or approved change already exists for this occurrence.", code="CHANGE_ALREADY_EXISTS")
        change = ScheduleChange(
            timetable_slot_id=slot.id, original_date=data.original_date, original_room_id=slot.room_id,
            original_start_time=slot.start_time, original_end_time=slot.end_time,
            change_type=ChangeType.CANCELLED.value, reason=data.reason, requested_by=user.id,
            approved_by=user.id, approved_at=now(), status=ChangeStatus.APPROVED.value)  # cancellations take effect immediately
        self.session.add(change)
        try:
            await self.session.flush()
        except IntegrityError:
            await self.session.rollback()
            raise ConflictError("A pending or approved change already exists for this occurrence.", code="CHANGE_ALREADY_EXISTS")
        await self._notify_students(slot, NotificationType.CLASS_CANCELLED, "Class cancelled",
                                    f"{slot.course.course_code} on {change.original_date:%d %b} {slot.start_time:%H:%M} is cancelled.")
        self.audit.record(user.id, "CLASS_CANCELLED", "schedule_change", change.id, None, snapshot(change, CHANGE_FIELDS))
        await self.session.commit()
        return change

    # ---- withdraw / revert ----------------------------------------------------------------------------------
    async def withdraw(self, user: User, change_id: int) -> ScheduleChange:
        change = await self.repo.get_for_update(change_id)
        if not change:
            raise NotFoundError("Schedule change not found.")
        if change.requested_by != user.id and user.role != Role.ADMIN.value:
            raise ForbiddenError("Only the requester or an admin can withdraw a change.", code="NOT_REQUESTER")
        if change.status not in (ChangeStatus.PENDING.value, ChangeStatus.APPROVED.value):
            raise ConflictError("Change can no longer be withdrawn.", code="INVALID_STATE")
        if change.status == ChangeStatus.APPROVED.value and combine(change.original_date, change.original_end_time) <= now():
            raise ConflictError("The original occurrence has already passed.", code="INVALID_STATE")
        was_approved = change.status == ChangeStatus.APPROVED.value
        old = snapshot(change, CHANGE_FIELDS)
        change.status = ChangeStatus.CANCELLED.value  # original timetable occurrence is effective again
        if was_approved:
            await self._notify_students(change.slot, NotificationType.CLASS_RESCHEDULED, "Class change reverted",
                                        f"{change.slot.course.course_code} on {change.original_date:%d %b} will take place as originally scheduled.")
        self.audit.record(user.id, "SCHEDULE_CHANGE_WITHDRAWN", "schedule_change", change.id, old, snapshot(change, CHANGE_FIELDS))
        await self.session.commit()
        return change

    # ---- queries ---------------------------------------------------------------------------------------
    async def list(self, user: User, params: PageParams, status: str | None = None, slot_id: int | None = None):
        requested_by = None if user.role == Role.ADMIN.value else user.id
        return await paginate(self.session, self.repo.list_stmt(requested_by=requested_by, status=status, slot_id=slot_id), params)

    async def get(self, user: User, change_id: int) -> ScheduleChange:
        c = await self.repo.get(change_id)
        if not c or (user.role != Role.ADMIN.value and c.requested_by != user.id):
            raise NotFoundError("Schedule change not found.")
        return c

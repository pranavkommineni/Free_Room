from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import AwareDatetime

from app.core.dependencies import CurrentUser, DbSession, FacultyAdminOrStudent, StudentOrAdmin
from app.core.exceptions import ValidationAppError
from app.repositories.user_repository import UserRepository
from app.schemas.room import (AvailabilityResponse, AvailableRoom, BreakResponse, ConflictOut, RecommendationResponse,
                              RoomCheckResponse)
from app.services.availability_service import AvailabilityService, AvailableRoom as Avail
from app.services.recommendation_service import RecommendationService
from app.services.timetable_service import TimetableService
from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.enums import Role

router = APIRouter(prefix="/availability", tags=["Availability"])

Start = Annotated[AwareDatetime, Query(description="ISO-8601 with offset, e.g. 2026-10-05T10:00:00+05:30 (URL-encode '+' as %2B)")]
End = Annotated[AwareDatetime, Query(description="Exclusive end of the interval")]


def _room_out(a: Avail) -> AvailableRoom:
    r = a.room
    return AvailableRoom(room_id=r.id, room_number=r.room_number, display_name=r.display_name, floor=r.floor_number,
                         capacity=r.capacity, has_projector=r.has_projector, has_ac=r.has_ac, available_until=a.available_until)


@router.get("", response_model=AvailabilityResponse, summary="Rooms genuinely free for the whole interval",
            description="ACTIVE room AND student-accessible (for students) AND no timetable class (effective schedule, "
                        "exceptions applied) AND no booking AND no maintenance AND no restriction.")
async def search_available(user: CurrentUser, session: DbSession, start_datetime: Start, end_datetime: End,
                           floor_id: int | None = None, building_id: int | None = None, minimum_capacity: int | None = Query(None, gt=0),
                           has_projector: bool | None = None, has_ac: bool | None = None):
    rooms = await AvailabilityService(session).find_available(
        start_datetime, end_datetime, user, building_id=building_id, floor_id=floor_id, minimum_capacity=minimum_capacity,
        has_projector=has_projector, has_ac=has_ac)
    return AvailabilityResponse(requested_start=start_datetime, requested_end=end_datetime, total_available=len(rooms),
                                rooms=[_room_out(a) for a in rooms])


@router.get("/break", response_model=BreakResponse, summary="Rooms free for a student's ENTIRE break",
            description="Only rooms that stay available for the whole requested interval are returned. Also reports whether the "
                        "student really is free (no class in their effective timetable) during that interval.")
async def break_search(user: StudentOrAdmin, session: DbSession, start_datetime: Start, end_datetime: End,
                       student_id: int | None = None, floor_id: int | None = None, building_id: int | None = None,
                       minimum_capacity: int | None = Query(None, gt=0), has_projector: bool | None = None, has_ac: bool | None = None):
    users = UserRepository(session)
    if user.role == Role.STUDENT.value:
        student = await users.student_by_user(user.id)
        if student_id is not None and (not student or student.id != student_id):
            raise ForbiddenError("Students can only search for their own break.")
    else:
        if student_id is None:
            raise ValidationAppError("student_id is required.", code="STUDENT_ID_REQUIRED")
        student = await users.student(student_id)
    if not student:
        raise NotFoundError("Student not found.", code="STUDENT_NOT_FOUND")
    clashes = await TimetableService(session).student_class_conflicts(student.section_id, start_datetime, end_datetime)
    rooms = await AvailabilityService(session).find_available(
        start_datetime, end_datetime, user, building_id=building_id, floor_id=floor_id, minimum_capacity=minimum_capacity,
        has_projector=has_projector, has_ac=has_ac)
    return BreakResponse(requested_start=start_datetime, requested_end=end_datetime, total_available=len(rooms),
                         rooms=[_room_out(a) for a in rooms], student_id=student.id, student_free=not clashes, student_conflicts=clashes)


@router.get("/rooms/{room_id}", response_model=RoomCheckResponse, summary="Is this specific room available? (with reasons)")
async def check_room(room_id: int, user: CurrentUser, session: DbSession, start_datetime: Start, end_datetime: End):
    _, conflicts = await AvailabilityService(session).check_room_id(room_id, start_datetime, end_datetime, user)
    return RoomCheckResponse(room_id=room_id, available=not conflicts, conflicts=[ConflictOut(**c.as_dict()) for c in conflicts])


@router.get("/recommendations", response_model=RecommendationResponse, summary="Ranked recommendations among available rooms",
            description="Deterministic weighted score (availability slack, capacity fit, facilities, historical utilization, floor "
                        "preference). Weights are configurable via REC_W_* settings.")
async def recommend(user: CurrentUser, session: DbSession, start_datetime: Start, end_datetime: End,
                    expected_attendance: int | None = Query(None, gt=0), has_projector: bool = False, has_ac: bool = False,
                    preferred_floor: int | None = None, limit: int = Query(10, ge=1, le=50)):
    return await RecommendationService(session).recommend(user, start_datetime, end_datetime, expected_attendance=expected_attendance,
                                                          has_projector=has_projector, has_ac=has_ac, preferred_floor=preferred_floor, limit=limit)

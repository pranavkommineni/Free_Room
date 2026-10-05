from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import RoomBooking, User
from app.models.enums import BookingStatus
from app.schemas.room import RecommendationResponse, RecommendedRoom
from app.services.availability_service import AvailabilityService
from app.utils.datetime_utils import now

LOOKBACK_DAYS = 30
FULL_SLACK_MINUTES = 120  # this much free time beyond the request = max availability score


def weights() -> dict[str, float]:
    return {"availability": settings.REC_W_AVAILABILITY, "capacity": settings.REC_W_CAPACITY, "facility": settings.REC_W_FACILITY,
            "utilization": settings.REC_W_UTILIZATION, "floor": settings.REC_W_FLOOR}


class RecommendationService:
    """Deterministic ranking of already-available rooms (no ML/LLM):
        score = w_a*availability + w_c*capacity_fit + w_f*facilities + w_u*(1-relative_utilization) + w_fl*floor_pref
    All components are in [0, 1]; weights come from settings (REC_W_*)."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.availability = AvailabilityService(session)

    async def _booked_hours(self, room_ids: list[int]) -> dict[int, float]:
        since = now() - timedelta(days=LOOKBACK_DAYS)
        hours = func.sum(func.extract("epoch", func.least(RoomBooking.end_datetime, now()) - func.greatest(RoomBooking.start_datetime, since)) / 3600)
        stmt = (select(RoomBooking.room_id, hours).where(
            RoomBooking.room_id.in_(room_ids), RoomBooking.status == BookingStatus.CONFIRMED.value,
            RoomBooking.end_datetime > since, RoomBooking.start_datetime < now()).group_by(RoomBooking.room_id))
        return {rid: float(h or 0) for rid, h in (await self.session.execute(stmt)).all()}

    async def recommend(self, user: User, start: datetime, end: datetime, *, expected_attendance: int | None = None,
                        has_projector: bool = False, has_ac: bool = False, preferred_floor: int | None = None,
                        limit: int = 10) -> RecommendationResponse:
        avail = await self.availability.find_available(start, end, user, minimum_capacity=expected_attendance)
        used = await self._booked_hours([a.room.id for a in avail]) if avail else {}
        max_used = max(used.values(), default=0.0)
        w = weights()
        ranked: list[RecommendedRoom] = []
        for a in avail:
            r = a.room
            slack = (a.available_until - end).total_seconds() / 60
            wanted = [(has_projector, r.has_projector), (has_ac, r.has_ac)]
            wanted = [ok for want, ok in wanted if want]
            parts = {
                "availability": min(1.0, max(0.0, slack / FULL_SLACK_MINUTES)),
                "capacity": min(1.0, expected_attendance / r.capacity) if expected_attendance else 0.5,
                "facility": (sum(wanted) / len(wanted)) if wanted else 1.0,
                "utilization": 1.0 - (used.get(r.id, 0.0) / max_used) if max_used > 0 else 1.0,
                "floor": 0.5 if preferred_floor is None else max(0.0, 1.0 - 0.25 * abs(r.floor_number - preferred_floor)),
            }
            score = sum(w[k] * v for k, v in parts.items())
            ranked.append(RecommendedRoom(room_id=r.id, room_number=r.room_number, display_name=r.display_name, floor=r.floor_number,
                                          capacity=r.capacity, has_projector=r.has_projector, has_ac=r.has_ac,
                                          available_until=a.available_until, score=round(score, 4),
                                          score_breakdown={k: round(v, 4) for k, v in parts.items()}))
        ranked.sort(key=lambda x: (-x.score, x.display_name))
        return RecommendationResponse(requested_start=start, requested_end=end, weights=w, rooms=ranked[:limit])

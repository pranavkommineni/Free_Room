from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Index, Integer, String, UniqueConstraint, false, true
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.enums import RoomStatus, RoomType, check_in
from app.models.floor import Floor


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("floor_id", "room_number", name="uq_rooms_floor_room"),
        CheckConstraint("capacity > 0", name="capacity_positive"),
        CheckConstraint(check_in("room_type", RoomType), name="room_type_valid"),
        CheckConstraint(check_in("status", RoomStatus), name="status_valid"),
        Index("ix_rooms_floor_id", "floor_id"),
        Index("ix_rooms_status", "status"),
        Index("ix_rooms_student_accessible", "student_accessible"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    floor_id: Mapped[int] = mapped_column(ForeignKey("floors.id", ondelete="RESTRICT"))
    room_number: Mapped[str] = mapped_column(String(20))
    capacity: Mapped[int] = mapped_column(Integer)
    room_type: Mapped[str] = mapped_column(String(20), default=RoomType.CLASSROOM.value, server_default=RoomType.CLASSROOM.value)
    has_ac: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    has_projector: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    student_accessible: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    status: Mapped[str] = mapped_column(String(16), default=RoomStatus.ACTIVE.value, server_default=RoomStatus.ACTIVE.value)

    floor: Mapped[Floor] = relationship(lazy="joined")

    @property
    def building_code(self) -> str:
        return self.floor.building.code

    @property
    def floor_number(self) -> int:
        return self.floor.floor_number

    @property
    def display_name(self) -> str:
        return f"{self.floor.building.code}-{self.room_number}"

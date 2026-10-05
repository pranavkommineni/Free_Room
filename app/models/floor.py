from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.building import Building


class Floor(Base):
    __tablename__ = "floors"
    __table_args__ = (
        UniqueConstraint("building_id", "floor_number", name="uq_floors_building_floor"),
        CheckConstraint("floor_number >= 0", name="floor_number_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id", ondelete="RESTRICT"), index=True)
    floor_number: Mapped[int] = mapped_column(SmallInteger)

    building: Mapped[Building] = relationship(lazy="joined")

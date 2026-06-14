from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Room(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hotel_id", "room_number", name="uq_rooms_hotel_number"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_number: Mapped[str] = mapped_column(String(40), index=True)
    room_type: Mapped[str | None] = mapped_column(String(80))
    floor: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="available")

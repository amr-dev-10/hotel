from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class RoomType(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "room_types"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_room_types_hotel_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(Text)
    max_occupancy: Mapped[int] = mapped_column(Integer, default=2)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    amenities: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Room(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("hotel_id", "room_number", name="uq_rooms_hotel_number"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_type_id: Mapped[str | None] = mapped_column(ForeignKey("room_types.id"), index=True)
    room_number: Mapped[str] = mapped_column(String(40), index=True)
    room_type: Mapped[str | None] = mapped_column(String(80))
    floor: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="available")
    notes: Mapped[str | None] = mapped_column(Text)

from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class RoomBlock(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "room_blocks"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"), index=True)
    room_type_id: Mapped[str | None] = mapped_column(ForeignKey("room_types.id"), index=True)
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[date] = mapped_column(Date, index=True)
    block_type: Mapped[str] = mapped_column(String(40), default="reservation", index=True)
    reference_type: Mapped[str | None] = mapped_column(String(80), index=True)
    reference_id: Mapped[str | None] = mapped_column(String(36), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

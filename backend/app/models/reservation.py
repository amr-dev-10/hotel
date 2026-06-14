from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Reservation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("hotel_id", "reservation_no", name="uq_reservations_hotel_no"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_no: Mapped[str] = mapped_column(String(80), index=True)
    guest_id: Mapped[str] = mapped_column(ForeignKey("guests.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    status: Mapped[str] = mapped_column(String(40), default="confirmed", index=True)
    checkin_date: Mapped[date] = mapped_column(Date)
    checkout_date: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(40), default="walk_in")


class StayRecord(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "stay_records"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    actual_checkin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_checkout: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin, utcnow


class Reservation(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "reservations"
    __table_args__ = (
        UniqueConstraint("hotel_id", "reservation_no", name="uq_reservations_hotel_no"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_no: Mapped[str] = mapped_column(String(80), index=True)
    guest_id: Mapped[str] = mapped_column(ForeignKey("guests.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    rate_plan_id: Mapped[str | None] = mapped_column(ForeignKey("rate_plans.id"))
    status: Mapped[str] = mapped_column(String(40), default="confirmed", index=True)
    checkin_date: Mapped[date] = mapped_column(Date)
    checkout_date: Mapped[date] = mapped_column(Date)
    source: Mapped[str] = mapped_column(String(40), default="walk_in")
    notes: Mapped[str | None] = mapped_column(Text)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    cancellation_reason: Mapped[str | None] = mapped_column(Text)


class ReservationGuest(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reservation_guests"
    __table_args__ = (UniqueConstraint("reservation_id", "guest_id", name="uq_reservation_guest"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), index=True)
    guest_id: Mapped[str] = mapped_column(ForeignKey("guests.id"), index=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)
    relationship: Mapped[str | None] = mapped_column(String(80))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ReservationRoomType(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "reservation_room_types"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), index=True)
    room_type_id: Mapped[str] = mapped_column(ForeignKey("room_types.id"), index=True)
    quantity: Mapped[int] = mapped_column(default=1)
    rate_plan_id: Mapped[str | None] = mapped_column(ForeignKey("rate_plans.id"))
    assigned_room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"), index=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class StayRecord(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "stay_records"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    actual_checkin: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_checkout: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

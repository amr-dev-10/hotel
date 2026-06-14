from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class GuestFolio(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "guest_folios"
    __table_args__ = (UniqueConstraint("hotel_id", "folio_number", name="uq_folio_hotel_number"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    reservation_id: Mapped[str] = mapped_column(ForeignKey("reservations.id"), index=True)
    guest_id: Mapped[str] = mapped_column(ForeignKey("guests.id"), index=True)
    folio_number: Mapped[str] = mapped_column(String(80), index=True)
    status: Mapped[str] = mapped_column(String(40), default="open", index=True)
    total_charges: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    total_payments: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    balance_due: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class FolioItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "folio_items"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    folio_id: Mapped[str] = mapped_column(ForeignKey("guest_folios.id"), index=True)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"))
    item_type: Mapped[str] = mapped_column(String(40), default="service", index=True)
    description: Mapped[str] = mapped_column(String(255))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    date: Mapped[date_type | None] = mapped_column(Date)
    posted_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TaxConfig(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "tax_configs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    rate_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    applies_to: Mapped[str] = mapped_column(String(40), default="all", index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Payment(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "payments"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    folio_id: Mapped[str] = mapped_column(ForeignKey("guest_folios.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    payment_method: Mapped[str] = mapped_column(String(80), default="cash")
    reference_no: Mapped[str | None] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="completed", index=True)
    collected_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Refund(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "refunds"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    payment_id: Mapped[str] = mapped_column(ForeignKey("payments.id"), index=True)
    folio_id: Mapped[str] = mapped_column(ForeignKey("guest_folios.id"), index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    reason: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="processed", index=True)
    processed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

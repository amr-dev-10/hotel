from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class Subscription(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (UniqueConstraint("hotel_id", name="uq_subscriptions_hotel"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    plan: Mapped[str] = mapped_column(String(40), default="starter")
    status: Mapped[str] = mapped_column(String(40), default="active")
    renewal_date: Mapped[date | None] = mapped_column(Date)
    billing_cycle: Mapped[str] = mapped_column(String(40), default="monthly")
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Invoice(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "invoices"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="draft")
    payment_method: Mapped[str | None] = mapped_column(String(80))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuditLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_logs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    old_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    new_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Notification(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notifications"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MediaFile(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "media_files"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    file_url: Mapped[str] = mapped_column(String(800))
    file_type: Mapped[str] = mapped_column(String(80))
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    storage_provider: Mapped[str] = mapped_column(String(80), default="local")
    uploaded_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

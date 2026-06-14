from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, JSON, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class WhatsAppSession(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "whatsapp_sessions"
    __table_args__ = (UniqueConstraint("hotel_id", "phone", name="uq_whatsapp_sessions_hotel_phone"),)

    phone: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    guest_id: Mapped[str | None] = mapped_column(String(36), index=True)
    room_id: Mapped[str | None] = mapped_column(String(36), index=True)
    state: Mapped[str] = mapped_column(String(80), default="new", index=True, nullable=False)
    cart: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    pending_action: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(80), index=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

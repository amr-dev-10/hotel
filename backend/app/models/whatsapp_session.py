from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class WhatsAppSession(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "whatsapp_sessions"
    __table_args__ = (
        UniqueConstraint("hotel_id", "phone", name="uq_whatsapp_sessions_hotel_phone"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    phone: Mapped[str] = mapped_column(String(40), index=True)
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    state: Mapped[str] = mapped_column(String(50), default="new", index=True)
    cart: Mapped[list[dict]] = mapped_column(JSON, default=list)
    pending_action: Mapped[dict | None] = mapped_column(JSON)
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(80), index=True)
    last_active_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

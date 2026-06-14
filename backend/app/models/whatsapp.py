from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class WhatsAppAccount(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "whatsapp_accounts"
    __table_args__ = (
        UniqueConstraint("hotel_id", "phone_number_id", name="uq_whatsapp_account_hotel_phone_id"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    business_name: Mapped[str] = mapped_column(String(180))
    phone_number: Mapped[str | None] = mapped_column(String(40))
    phone_number_id: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    waba_id: Mapped[str | None] = mapped_column(String(100))
    access_token: Mapped[str | None] = mapped_column(Text)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text)
    webhook_verify_token: Mapped[str | None] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="active")
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WhatsAppAccountHealth(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "whatsapp_account_health"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    whatsapp_account_id: Mapped[str] = mapped_column(ForeignKey("whatsapp_accounts.id"), index=True)
    last_message_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_message_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_webhook_received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    token_status: Mapped[str] = mapped_column(String(40), default="valid")
    webhook_status: Mapped[str] = mapped_column(String(40), default="active")
    error_count_24h: Mapped[int] = mapped_column(Integer, default=0)
    last_error_message: Mapped[str | None] = mapped_column(Text)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WhatsAppUsage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "whatsapp_usage"
    __table_args__ = (UniqueConstraint("hotel_id", "year_month", name="uq_whatsapp_usage_month"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    year_month: Mapped[str] = mapped_column(String(7), index=True)
    messages_sent: Mapped[int] = mapped_column(Integer, default=0)
    messages_received: Mapped[int] = mapped_column(Integer, default=0)
    template_sent: Mapped[int] = mapped_column(Integer, default=0)
    media_sent: Mapped[int] = mapped_column(Integer, default=0)
    api_calls: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WhatsAppTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "whatsapp_templates"
    __table_args__ = (
        UniqueConstraint("hotel_id", "template_name", "language", name="uq_whatsapp_template"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    template_name: Mapped[str] = mapped_column(String(120))
    template_type: Mapped[str] = mapped_column(String(80), default="promotional")
    language: Mapped[str] = mapped_column(String(20), default="en")
    status: Mapped[str] = mapped_column(String(40), default="pending")
    meta_template_id: Mapped[str | None] = mapped_column(String(120))
    header_params: Mapped[list[dict]] = mapped_column(JSON, default=list)
    body_params: Mapped[list[dict]] = mapped_column(JSON, default=list)


class WhatsAppConversation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "whatsapp_conversations"
    __table_args__ = (
        UniqueConstraint("hotel_id", "guest_id", name="uq_whatsapp_conversation_guest"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    phone: Mapped[str] = mapped_column(String(40), index=True)
    status: Mapped[str] = mapped_column(String(40), default="open")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class WhatsAppMessage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "whatsapp_messages"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("whatsapp_conversations.id"),
        index=True,
    )
    direction: Mapped[str] = mapped_column(String(20))
    message_type: Mapped[str] = mapped_column(String(40), default="text")
    message_text: Mapped[str | None] = mapped_column(Text)
    meta_message_id: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(40), default="sent")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class LiveChatSession(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "live_chat_sessions"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    guest_phone: Mapped[str] = mapped_column(String(40), index=True)
    assigned_staff_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(40), default="waiting", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_by: Mapped[str | None] = mapped_column(String(40))

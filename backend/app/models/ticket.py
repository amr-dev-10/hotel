from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin

ticket_menu_items = Table(
    "ticket_menu_items",
    Base.metadata,
    Column("ticket_id", ForeignKey("tickets.id"), primary_key=True),
    Column("menu_item_id", ForeignKey("menu_items.id"), primary_key=True),
)


class Ticket(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "tickets"
    __table_args__ = (
        UniqueConstraint("hotel_id", "ticket_code", name="uq_tickets_hotel_code"),
        Index("ix_ticket_hotel_dept", "hotel_id", "department_id"),
        Index("ix_ticket_hotel_assigned", "hotel_id", "assigned_to"),
        Index("ix_ticket_hotel_created", "hotel_id", "created_at", "id"),
        Index("ix_ticket_hotel_priority", "hotel_id", "priority"),
        Index("ix_ticket_hotel_stage", "hotel_id", "stage"),
    )

    ticket_code: Mapped[str] = mapped_column(String(40), index=True)
    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    reservation_id: Mapped[str | None] = mapped_column(ForeignKey("reservations.id"), index=True)
    conversation_id: Mapped[str | None] = mapped_column(ForeignKey("whatsapp_conversations.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"))
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    stage: Mapped[str] = mapped_column(String(40), default="Open", index=True)
    mobile_workflow_step: Mapped[str | None] = mapped_column(String(40), index=True)
    mobile_delivery_status: Mapped[str | None] = mapped_column(String(40), index=True)
    mobile_room_no: Mapped[str | None] = mapped_column(String(80), index=True)
    mobile_updated_room_no: Mapped[str | None] = mapped_column(String(80))
    mobile_guest_name: Mapped[str | None] = mapped_column(String(255))
    mobile_task_adder_id: Mapped[str | None] = mapped_column(String(40), index=True)
    mobile_task_adder_name: Mapped[str | None] = mapped_column(String(255))
    mobile_priority_label: Mapped[str | None] = mapped_column(String(40), index=True)
    mobile_ticket_type: Mapped[str | None] = mapped_column(String(80), index=True)
    mobile_item_ordered: Mapped[str | None] = mapped_column(Text)
    mobile_note: Mapped[str | None] = mapped_column(Text)
    mobile_paid_by: Mapped[str | None] = mapped_column(String(120))
    mobile_desired_date: Mapped[str | None] = mapped_column(String(40))
    mobile_desired_time: Mapped[str | None] = mapped_column(String(40))
    mobile_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    type: Mapped[str] = mapped_column(String(40), default="Ticket")
    task_category_id: Mapped[str | None] = mapped_column(ForeignKey("ticket_categories.id"), index=True)
    task_category: Mapped[str | None] = mapped_column(String(80), index=True)
    item_description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(40), default="DASHBOARD")
    followers: Mapped[list[str]] = mapped_column(JSON, default=list)
    priority: Mapped[int] = mapped_column(Integer, default=2)
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TicketEvent(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ticket_events"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    event_type: Mapped[str] = mapped_column(String(80), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class TicketMessage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ticket_messages"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    sender_type: Mapped[str] = mapped_column(String(40))
    sender_id: Mapped[str | None] = mapped_column(String(36))
    content: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MobileChatMessage(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "mobile_chat_messages"
    __table_args__ = (
        Index("ix_mobile_chat_hotel_room", "hotel_id", "room_key", "created_at"),
        Index("ix_mobile_chat_hotel_receiver", "hotel_id", "receiver_id"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_key: Mapped[str] = mapped_column(String(160), index=True)
    chat_type: Mapped[str] = mapped_column(String(20), default="USER", index=True)
    sender_id: Mapped[str] = mapped_column(String(40), index=True)
    receiver_id: Mapped[str] = mapped_column(String(80), index=True)
    sender_name: Mapped[str | None] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    system_marker: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

from enum import Enum
from datetime import datetime

from sqlalchemy import DateTime, Enum as SqlEnum, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class TicketPriority(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class TicketStatus(str, Enum):
    created = "created"
    assigned = "assigned"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    closed = "closed"


class Ticket(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "tickets"
    __table_args__ = (UniqueConstraint("hotel_id", "ticket_code", name="uq_tickets_hotel_code"),)

    workflow_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    ticket_code: Mapped[str | None] = mapped_column(String(40), index=True)
    guest_id: Mapped[str | None] = mapped_column(String(36), index=True)
    room_id: Mapped[str | None] = mapped_column(String(36), index=True)
    department_id: Mapped[str | None] = mapped_column(String(36), index=True)
    title: Mapped[str] = mapped_column(String(180), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[TicketPriority] = mapped_column(
        SqlEnum(TicketPriority), default=TicketPriority.medium, nullable=False
    )
    status: Mapped[TicketStatus] = mapped_column(
        SqlEnum(TicketStatus), default=TicketStatus.created, index=True, nullable=False
    )
    stage: Mapped[str] = mapped_column(String(40), default="created", index=True, nullable=False)
    type: Mapped[str | None] = mapped_column(String(80))
    item_description: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(40), default="android", nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(String(36), index=True)
    created_by: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    sla_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)


class TicketMessage(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "ticket_messages"

    ticket_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    sender_type: Mapped[str] = mapped_column(String(40), default="staff", nullable=False)
    sender_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text, nullable=False)


class TicketAssignment(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "ticket_assignments"

    ticket_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    assigned_to: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    assigned_by: Mapped[str] = mapped_column(String(36), index=True, nullable=False)


class TicketAttachment(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "ticket_attachments"

    ticket_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)


class TicketHistory(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "ticket_history"

    ticket_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    from_stage: Mapped[str | None] = mapped_column(String(40))
    to_stage: Mapped[str] = mapped_column(String(40), nullable=False)
    changed_by: Mapped[str | None] = mapped_column(String(36), index=True)
    changed_at: Mapped[str] = mapped_column(String(40), nullable=False)

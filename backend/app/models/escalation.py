from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class EscalationRule(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "escalation_rules"
    __table_args__ = (
        UniqueConstraint(
            "hotel_id",
            "department_id",
            "ticket_type",
            "task_category",
            "escalation_level",
            name="uq_escalation_rule_scope",
        ),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), index=True)
    ticket_type: Mapped[str | None] = mapped_column(String(40), index=True)
    task_category: Mapped[str | None] = mapped_column(String(80), index=True)
    escalation_level: Mapped[int] = mapped_column(Integer, index=True)
    trigger_after_minutes: Mapped[int] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(40), default="escalate_up")
    target_staff_level: Mapped[str | None] = mapped_column(String(20))
    auto_reassign: Mapped[bool] = mapped_column(Boolean, default=False)
    send_notification: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_channels: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class EscalationLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "escalation_log"

    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    rule_id: Mapped[str] = mapped_column(ForeignKey("escalation_rules.id"), index=True)
    escalation_level: Mapped[int] = mapped_column(Integer, index=True)
    escalated_from: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    escalated_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(String(80), default="sla_breach", index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)

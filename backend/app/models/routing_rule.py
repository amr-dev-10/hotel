from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class RoutingRule(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "routing_rules"
    __table_args__ = (UniqueConstraint("hotel_id", "ticket_type", name="uq_routing_rule_type"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    ticket_type: Mapped[str] = mapped_column(String(40), index=True)
    target_staff_level: Mapped[str | None] = mapped_column(String(20), index=True)
    target_user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    skip_normal_assignment: Mapped[bool] = mapped_column(Boolean, default=True)
    priority_override: Mapped[int | None] = mapped_column(Integer)
    notify_immediately: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_channels: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

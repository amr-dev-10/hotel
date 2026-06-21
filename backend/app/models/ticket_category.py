from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class TicketCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ticket_categories"
    __table_args__ = (
        UniqueConstraint("hotel_id", "key", name="uq_ticket_category_hotel_key"),
        Index("ix_ticket_category_hotel_dept", "hotel_id", "department_id"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), index=True)
    key: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    default_priority: Mapped[int] = mapped_column(Integer, default=2)
    sla_minutes: Mapped[int] = mapped_column(Integer, default=10)
    accept_timeout_minutes: Mapped[int] = mapped_column(Integer, default=2)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

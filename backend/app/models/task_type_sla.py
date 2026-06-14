from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class TaskTypeSLA(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "task_type_slas"
    __table_args__ = (
        UniqueConstraint(
            "hotel_id",
            "department_id",
            "task_category",
            name="uq_task_type_sla_scope",
        ),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), index=True)
    task_category: Mapped[str] = mapped_column(String(80), index=True)
    sla_minutes: Mapped[int] = mapped_column(Integer)
    accept_timeout_minutes: Mapped[int] = mapped_column(Integer, default=2)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

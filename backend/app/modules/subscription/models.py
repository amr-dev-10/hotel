from datetime import datetime

from sqlalchemy import DateTime, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class Plan(Base, UuidPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "plans"

    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    max_users: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    max_tickets: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    storage_gb: Mapped[int] = mapped_column(Integer, default=5, nullable=False)


class Subscription(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "subscriptions"

    plan_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="active", index=True, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TenantUsage(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "tenant_usage"
    __table_args__ = (UniqueConstraint("tenant_id", "metric", name="uq_tenant_usage_metric"),)

    metric: Mapped[str] = mapped_column(String(80), nullable=False)
    used: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    limit: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class Feature(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "features"

    code: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180))
    module: Mapped[str] = mapped_column(String(80), index=True)
    description: Mapped[str | None] = mapped_column(Text)


class PlanFeature(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "plan_features"
    __table_args__ = (UniqueConstraint("plan", "feature_id", name="uq_plan_feature"),)

    plan: Mapped[str] = mapped_column(String(40), index=True)
    feature_id: Mapped[str] = mapped_column(ForeignKey("features.id"), index=True)
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    limit_value: Mapped[int | None] = mapped_column(Integer)
    limit_unit: Mapped[str | None] = mapped_column(String(40))


class UsageLimit(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "usage_limits"
    __table_args__ = (UniqueConstraint("hotel_id", "feature_code", "period", name="uq_usage_limit_period"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    feature_code: Mapped[str] = mapped_column(String(120), index=True)
    period: Mapped[str] = mapped_column(String(7), index=True)
    limit_value: Mapped[int | None] = mapped_column(Integer)
    used_value: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

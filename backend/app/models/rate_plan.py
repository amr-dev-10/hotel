from datetime import date
from decimal import Decimal

from sqlalchemy import Boolean, Date, ForeignKey, JSON, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class RatePlan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "rate_plans"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    description: Mapped[str | None] = mapped_column(String(500))
    room_type_id: Mapped[str] = mapped_column(ForeignKey("room_types.id"), index=True)
    base_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    includes: Mapped[list[str]] = mapped_column(JSON, default=list)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class RatePlanPeriod(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "rate_plan_periods"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    rate_plan_id: Mapped[str] = mapped_column(ForeignKey("rate_plans.id"), index=True)
    name: Mapped[str] = mapped_column(String(160))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    price_override: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    multiplier: Mapped[Decimal | None] = mapped_column(Numeric(4, 2))
    day_of_week: Mapped[list[str] | None] = mapped_column(JSON)

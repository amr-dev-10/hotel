from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RatePlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: str | None = None
    room_type_id: str
    base_price: Decimal = Decimal("0")
    includes: list[str] = Field(default_factory=list)
    is_default: bool = False
    is_active: bool = True


class RatePlanUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    room_type_id: str | None = None
    base_price: Decimal | None = None
    includes: list[str] | None = None
    is_default: bool | None = None
    is_active: bool | None = None


class RatePlanRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    description: str | None = None
    room_type_id: str
    base_price: Decimal
    includes: list[str]
    is_default: bool
    is_active: bool


class RatePlanPeriodCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    start_date: date | None = None
    end_date: date | None = None
    price_override: Decimal | None = None
    multiplier: Decimal | None = None
    day_of_week: list[str] | None = None


class RatePlanPeriodRead(ORMModel):
    id: str
    hotel_id: str
    rate_plan_id: str
    name: str
    start_date: date | None = None
    end_date: date | None = None
    price_override: Decimal | None = None
    multiplier: Decimal | None = None
    day_of_week: list[str] | None = None

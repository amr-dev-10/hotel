from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class FeatureCreate(BaseModel):
    code: str = Field(min_length=2, max_length=120)
    name: str = Field(min_length=2, max_length=180)
    module: str
    description: str | None = None


class FeatureRead(ORMModel):
    id: str
    code: str
    name: str
    module: str
    description: str | None = None


class PlanFeatureUpsert(BaseModel):
    plan: str
    feature_code: str
    is_enabled: bool = True
    limit_value: int | None = None
    limit_unit: str | None = None


class PlanFeatureRead(ORMModel):
    id: str
    plan: str
    feature_id: str
    is_enabled: bool
    limit_value: int | None = None
    limit_unit: str | None = None


class UsageLimitRead(ORMModel):
    id: str
    hotel_id: str
    feature_code: str
    period: str
    limit_value: int | None = None
    used_value: int
    updated_at: datetime

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel
from app.schemas.hotel import HotelRead
from app.schemas.user import UserRead


class JobExecutionCreate(BaseModel):
    job_name: str
    job_type: str = "manual"
    hotel_id: str | None = None
    input_params: dict = Field(default_factory=dict)
    celery_task_id: str | None = None


class JobExecutionRead(ORMModel):
    id: str
    job_name: str
    job_type: str
    hotel_id: str | None = None
    status: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    duration_ms: int | None = None
    input_params: dict
    result: dict
    error_message: str | None = None
    retry_count: int
    max_retries: int
    next_retry_at: datetime | None = None
    celery_task_id: str | None = None
    created_at: datetime


class ApiRateLimitUpsert(BaseModel):
    endpoint_group: str
    max_requests: int = Field(gt=0)
    window_seconds: int = Field(gt=0)


class ApiRateLimitRead(ORMModel):
    id: str
    hotel_id: str
    endpoint_group: str
    max_requests: int
    window_seconds: int
    created_at: datetime


class ExportJobCreate(BaseModel):
    export_type: str
    format: str = "csv"
    filters: dict = Field(default_factory=dict)


class ExportJobRead(ORMModel):
    id: str
    hotel_id: str
    export_type: str
    format: str
    filters: dict
    status: str
    file_url: str | None = None
    file_size_bytes: int | None = None
    row_count: int | None = None
    requested_by: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    expires_at: datetime | None = None
    created_at: datetime


class ImportJobCreate(BaseModel):
    import_type: str
    source_file_url: str
    rows: list[dict] = Field(default_factory=list)


class ImportJobRead(ORMModel):
    id: str
    hotel_id: str
    import_type: str
    source_file_url: str
    status: str
    total_rows: int
    processed_rows: int
    successful_rows: int
    failed_rows: int
    errors: list[dict]
    uploaded_by: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class PlatformLoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class PlatformDashboardRead(BaseModel):
    total_hotels: int
    active_hotels: int
    total_rooms: int
    total_users: int
    mrr: Decimal
    whatsapp_usage: dict[str, int | float]


class PlatformHotelCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=255)
    owner_name: str = Field(min_length=2, max_length=255)
    owner_email: EmailStr
    owner_password: str = Field(min_length=8)
    address: str | None = None
    timezone: str = "UTC"
    contact_phone: str | None = None
    whatsapp_phone_number_id: str | None = None
    subscription_tier: str = "starter"
    seed_rooms: list[str] = Field(default_factory=list)


class PlatformHotelSummary(ORMModel):
    id: str
    slug: str
    name: str
    subscription_tier: str
    status: str
    active_users: int
    total_rooms: int
    open_tickets: int
    created_at: datetime


class PlatformHotelCreateResponse(BaseModel):
    hotel: HotelRead
    owner: UserRead


class PlatformUserSummary(ORMModel):
    id: str
    hotel_id: str
    department_id: str | None = None
    reports_to: str | None = None
    name: str
    email: EmailStr
    user_type: str
    staff_level: str | None = None
    job_role: str | None = None
    is_hotel_owner: bool
    is_active: bool
    is_on_duty: bool
    created_at: datetime


class PlatformSubscriptionSummary(ORMModel):
    id: str
    hotel_id: str
    plan: str
    status: str
    billing_cycle: str
    renewal_date: date | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancelled_at: datetime | None = None
    created_at: datetime


class PlatformSubscriptionUpdate(BaseModel):
    plan: str | None = Field(default=None, min_length=2, max_length=40)
    status: str | None = Field(default=None, min_length=2, max_length=40)
    billing_cycle: str | None = Field(default=None, min_length=2, max_length=40)
    renewal_date: date | None = None
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancelled_at: datetime | None = None


class PlatformSettingRead(ORMModel):
    key: str
    value: Any
    description: str | None = None
    updated_by: str | None = None
    updated_at: datetime


class PlatformSettingsUpdate(BaseModel):
    settings: dict[str, Any] = Field(default_factory=dict)

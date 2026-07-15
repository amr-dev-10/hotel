from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class AuditLogRead(ORMModel):
    id: str
    hotel_id: str
    user_id: str | None = None
    action: str
    entity: str
    entity_id: str | None = None
    payload: dict
    old_payload: dict
    new_payload: dict
    ip_address: str | None = None
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: str | None = None
    channel: str = "websocket"
    title: str = Field(min_length=1, max_length=180)
    message: str = Field(min_length=1)
    notification_type: str = "general"
    reference_id: str | None = None
    metadata: dict = Field(default_factory=dict)


class NotificationRead(ORMModel):
    id: str
    hotel_id: str
    user_id: str | None = None
    channel: str
    title: str
    message: str
    status: str
    notification_type: str
    reference_id: str | None = None
    metadata: dict = Field(default_factory=dict, validation_alias="metadata_json")
    read_at: datetime | None = None
    created_at: datetime


class FCMTokenRegister(BaseModel):
    token: str = Field(min_length=20, max_length=500)
    platform: str = Field(default="android", min_length=2, max_length=40)


class FCMTokenRead(ORMModel):
    id: str
    hotel_id: str
    user_id: str
    token: str
    platform: str
    updated_at: datetime


class MediaFileCreate(BaseModel):
    file_url: str | None = Field(default=None, min_length=2, max_length=800)
    file_type: str = Field(min_length=2, max_length=80)
    file_name: str | None = None
    file_size_bytes: int | None = None
    storage_provider: str = "local"
    file_data_base64: str | None = None


class MediaFileRead(ORMModel):
    id: str
    hotel_id: str
    file_url: str
    file_type: str
    file_name: str | None = None
    file_size_bytes: int | None = None
    storage_provider: str
    uploaded_by: str | None = None
    created_at: datetime


class SubscriptionRead(ORMModel):
    hotel_id: str
    id: str
    plan: str
    status: str
    renewal_date: date | None = None
    billing_cycle: str
    current_period_start: datetime | None = None
    current_period_end: datetime | None = None
    cancelled_at: datetime | None = None


class SubscriptionUpgrade(BaseModel):
    plan: str = Field(min_length=2, max_length=40)
    billing_cycle: str = "monthly"


class InvoiceCreate(BaseModel):
    amount: Decimal
    currency: str = "INR"
    stripe_invoice_id: str | None = None
    status: str = "draft"
    payment_method: str | None = None
    due_date: datetime | None = None


class InvoiceRead(ORMModel):
    id: str
    hotel_id: str
    subscription_id: str
    amount: Decimal
    currency: str
    stripe_invoice_id: str | None = None
    status: str
    payment_method: str | None = None
    due_date: datetime | None = None
    paid_at: datetime | None = None
    created_at: datetime

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
    created_at: datetime


class NotificationCreate(BaseModel):
    user_id: str | None = None
    channel: str = "websocket"
    title: str = Field(min_length=1, max_length=180)
    message: str = Field(min_length=1)


class NotificationRead(ORMModel):
    id: str
    hotel_id: str
    user_id: str | None = None
    channel: str
    title: str
    message: str
    status: str
    created_at: datetime


class MediaFileCreate(BaseModel):
    file_url: str = Field(min_length=2, max_length=800)
    file_type: str = Field(min_length=2, max_length=80)


class MediaFileRead(ORMModel):
    id: str
    hotel_id: str
    file_url: str
    file_type: str
    uploaded_by: str | None = None
    created_at: datetime


class SubscriptionRead(ORMModel):
    hotel_id: str
    plan: str
    status: str
    renewal_date: date | None = None


class InvoiceCreate(BaseModel):
    amount: Decimal
    currency: str = "INR"
    stripe_invoice_id: str | None = None
    status: str = "draft"


class InvoiceRead(ORMModel):
    id: str
    hotel_id: str
    subscription_id: str
    amount: Decimal
    currency: str
    stripe_invoice_id: str | None = None
    status: str
    created_at: datetime

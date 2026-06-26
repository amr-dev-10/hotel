from datetime import date as date_type
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class FolioRead(ORMModel):
    id: str
    hotel_id: str
    reservation_id: str
    guest_id: str
    folio_number: str
    status: str
    total_charges: Decimal
    total_payments: Decimal
    balance_due: Decimal
    currency: str
    created_at: datetime
    closed_at: datetime | None = None


class FolioItemCreate(BaseModel):
    ticket_id: str | None = None
    item_type: str = "service"
    description: str = Field(min_length=1, max_length=255)
    quantity: int = 1
    unit_price: Decimal = Decimal("0")
    tax_amount: Decimal = Decimal("0")
    discount_amount: Decimal = Decimal("0")
    total_amount: Decimal | None = None
    date: date_type | None = None


class FolioItemRead(ORMModel):
    id: str
    hotel_id: str
    folio_id: str
    ticket_id: str | None = None
    item_type: str
    description: str
    quantity: int
    unit_price: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    total_amount: Decimal
    date: date_type | None = None
    posted_by: str | None = None
    created_at: datetime


class PaymentCreate(BaseModel):
    amount: Decimal
    currency: str = "INR"
    payment_method: str = "cash"
    reference_no: str | None = None
    status: str = "completed"


class PaymentGatewayOrderCreate(BaseModel):
    amount: Decimal
    currency: str = "INR"
    gateway: str = "manual"
    raw_request: dict = Field(default_factory=dict)


class PaymentRead(ORMModel):
    id: str
    hotel_id: str
    folio_id: str
    amount: Decimal
    currency: str
    payment_method: str
    reference_no: str | None = None
    status: str
    collected_by: str | None = None
    created_at: datetime


class PaymentTransactionRead(ORMModel):
    id: str
    payment_id: str
    hotel_id: str
    gateway: str
    gateway_order_id: str | None = None
    gateway_txn_id: str | None = None
    gateway_status: str
    amount: Decimal
    currency: str
    raw_request: dict
    raw_response: dict
    webhook_received_at: datetime | None = None
    created_at: datetime


class PaymentWebhookPayload(BaseModel):
    gateway_txn_id: str
    gateway_status: str = "captured"
    raw_response: dict = Field(default_factory=dict)


class RefundCreate(BaseModel):
    payment_id: str
    amount: Decimal
    reason: str | None = None
    status: str = "processed"


class RefundRead(ORMModel):
    id: str
    hotel_id: str
    payment_id: str
    folio_id: str
    amount: Decimal
    reason: str | None = None
    status: str
    processed_by: str | None = None
    created_at: datetime


class TaxConfigCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    tax_type: str = "percentage"
    rate_percent: Decimal = Decimal("0")
    fixed_amount: Decimal = Decimal("0")
    applies_to: str = "all"
    is_active: bool = True


class TaxConfigUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = None
    tax_type: str | None = None
    rate_percent: Decimal | None = None
    fixed_amount: Decimal | None = None
    applies_to: str | None = None
    is_active: bool | None = None


class TaxConfigRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    description: str | None = None
    tax_type: str
    rate_percent: Decimal
    fixed_amount: Decimal
    applies_to: str
    is_active: bool

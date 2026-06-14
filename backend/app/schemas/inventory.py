from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class VendorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    contact_phone: str | None = None
    contact_email: EmailStr | None = None
    address: str | None = None
    category: str | None = None
    is_active: bool = True


class VendorRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    contact_phone: str | None = None
    contact_email: EmailStr | None = None
    address: str | None = None
    category: str | None = None
    is_active: bool


class InventoryItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    category: str
    unit: str = "piece"
    min_stock: int = 0
    current_stock: int = 0
    cost_per_unit: Decimal = Decimal("0")
    default_vendor_id: str | None = None
    is_active: bool = True


class InventoryItemRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    category: str
    unit: str
    min_stock: int
    current_stock: int
    cost_per_unit: Decimal
    default_vendor_id: str | None = None
    is_active: bool


class InventoryIssueRequest(BaseModel):
    item_id: str
    quantity: int = Field(gt=0)
    reference_type: str = "manual"
    reference_id: str | None = None
    notes: str | None = None


class InventoryAdjustRequest(BaseModel):
    item_id: str
    quantity: int
    transaction_type: str = "adjustment"
    reference_type: str = "manual"
    reference_id: str | None = None
    notes: str | None = None


class InventoryTransactionRead(ORMModel):
    id: str
    hotel_id: str
    item_id: str
    transaction_type: str
    quantity: int
    reference_type: str | None = None
    reference_id: str | None = None
    notes: str | None = None
    performed_by: str | None = None
    created_at: datetime


class PurchaseOrderItemCreate(BaseModel):
    item_id: str
    quantity: int = Field(gt=0)
    unit_price: Decimal = Decimal("0")


class PurchaseOrderCreate(BaseModel):
    vendor_id: str
    notes: str | None = None
    items: list[PurchaseOrderItemCreate] = Field(default_factory=list)


class PurchaseOrderRead(ORMModel):
    id: str
    hotel_id: str
    po_number: str
    vendor_id: str
    status: str
    total_amount: Decimal
    notes: str | None = None
    created_by: str | None = None
    approved_by: str | None = None
    received_at: datetime | None = None
    created_at: datetime


class PurchaseOrderItemRead(ORMModel):
    id: str
    hotel_id: str
    purchase_order_id: str
    item_id: str
    quantity: int
    unit_price: Decimal
    received_qty: int

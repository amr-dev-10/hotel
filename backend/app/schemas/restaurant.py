from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RestaurantTableCreate(BaseModel):
    table_number: str = Field(min_length=1, max_length=80)
    section: str | None = None
    capacity: int = 2
    status: str = "available"


class RestaurantTableRead(ORMModel):
    id: str
    hotel_id: str
    table_number: str
    section: str | None = None
    capacity: int
    status: str


class RestaurantOrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: int = Field(default=1, gt=0)
    unit_price: Decimal | None = None
    notes: str | None = None


class RestaurantOrderCreate(BaseModel):
    source: str = "pos"
    table_id: str | None = None
    guest_id: str | None = None
    room_id: str | None = None
    ticket_id: str | None = None
    folio_id: str | None = None
    special_instructions: str | None = None
    tax: Decimal = Decimal("0")
    ordered_by_guest: bool = False
    items: list[RestaurantOrderItemCreate] = Field(default_factory=list)


class RestaurantOrderUpdate(BaseModel):
    source: str | None = None
    table_id: str | None = None
    guest_id: str | None = None
    room_id: str | None = None
    ticket_id: str | None = None
    folio_id: str | None = None
    special_instructions: str | None = None
    tax: Decimal | None = None
    ordered_by_guest: bool | None = None
    status: str | None = None
    items: list[RestaurantOrderItemCreate] | None = None


class RestaurantOrderRead(ORMModel):
    id: str
    hotel_id: str
    order_number: str
    source: str
    table_id: str | None = None
    guest_id: str | None = None
    room_id: str | None = None
    ticket_id: str | None = None
    folio_id: str | None = None
    ordered_by_guest: bool
    status: str
    subtotal: Decimal
    tax: Decimal
    total: Decimal
    special_instructions: str | None = None
    taken_by: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class RestaurantOrderItemRead(ORMModel):
    id: str
    hotel_id: str
    order_id: str
    menu_item_id: str
    quantity: int
    unit_price: Decimal
    item_total: Decimal
    status: str
    notes: str | None = None


class RestaurantOrderStatusUpdate(BaseModel):
    status: str


class RestaurantOrderDetail(BaseModel):
    order: RestaurantOrderRead
    items: list[RestaurantOrderItemRead]

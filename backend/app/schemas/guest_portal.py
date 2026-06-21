from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.guest import GuestRead
from app.schemas.menu import MenuCategoryRead, MenuItemRead
from app.schemas.reservation import ReservationRead
from app.schemas.restaurant import RestaurantOrderItemCreate, RestaurantOrderItemRead, RestaurantOrderRead
from app.schemas.ticket import TicketRead


class GuestPortalLoginRequest(BaseModel):
    hotel_id: str
    phone: str = Field(min_length=4, max_length=40)
    room_number: str = Field(min_length=1, max_length=40)


class GuestPortalTokenRequest(BaseModel):
    token: str = Field(min_length=20)


class GuestPortalProfile(BaseModel):
    guest: GuestRead
    reservation: ReservationRead
    room_number: str | None = None


class GuestPortalSessionRead(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    profile: GuestPortalProfile


class GuestPortalOrderCreate(BaseModel):
    items: list[RestaurantOrderItemCreate] = Field(min_length=1)
    special_instructions: str | None = Field(default=None, max_length=500)


class GuestPortalOrderDetail(BaseModel):
    order: RestaurantOrderRead
    items: list[RestaurantOrderItemRead]


class GuestPortalRequestCreate(BaseModel):
    item_description: str = Field(min_length=3, max_length=500)
    department_key: str | None = None
    task_category_id: str | None = None
    task_category: str | None = None
    priority: int = Field(default=2, ge=1, le=5)


class GuestPortalMenu(BaseModel):
    categories: list[MenuCategoryRead]
    items: list[MenuItemRead]


class GuestPortalSummary(BaseModel):
    today: date
    active_orders: int
    open_requests: int
    balance_due: Decimal | None = None
    last_order_at: datetime | None = None
    profile: GuestPortalProfile

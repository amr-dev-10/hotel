from decimal import Decimal

from pydantic import BaseModel, Field


class MenuCategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    type: str = Field(default="food", max_length=40)
    display_order: int = 0
    is_active: bool = True


class MenuCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: str | None = Field(default=None, max_length=40)
    display_order: int | None = None
    is_active: bool | None = None


class MenuCategoryRead(BaseModel):
    id: str
    hotel_id: str
    name: str
    type: str
    display_order: int
    is_active: bool


class MenuItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    price: Decimal = Decimal("0.00")
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    is_available: bool = True
    display_order: int = 0


class MenuItemUpdate(BaseModel):
    category_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    price: Decimal | None = None
    description: str | None = None
    image_url: str | None = Field(default=None, max_length=500)
    is_available: bool | None = None
    display_order: int | None = None


class MenuItemRead(BaseModel):
    id: str
    hotel_id: str
    category_id: str
    name: str
    price: Decimal
    description: str | None
    image_url: str | None
    is_available: bool
    display_order: int

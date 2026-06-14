from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class MenuCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    type: str = "food"
    display_order: int = 0
    is_active: bool = True


class MenuCategoryRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    type: str
    display_order: int
    is_active: bool


class MenuItemCreate(BaseModel):
    category_id: str
    name: str = Field(min_length=2, max_length=180)
    price: Decimal = Decimal("0.00")
    description: str | None = None
    image_url: str | None = None
    is_available: bool = True
    display_order: int = 0


class MenuItemRead(ORMModel):
    id: str
    hotel_id: str
    category_id: str
    name: str
    price: Decimal
    description: str | None = None
    image_url: str | None = None
    is_available: bool
    display_order: int

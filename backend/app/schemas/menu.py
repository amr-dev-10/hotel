from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class MenuCategoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    type: str = "food"
    display_order: int = 0
    is_active: bool = True


class MenuCategoryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    type: str | None = None
    display_order: int | None = None
    is_active: bool | None = None


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
    description_short: str | None = Field(default=None, max_length=255)
    dietary_tags: list[str] = Field(default_factory=list)
    preparation_time_minutes: int = Field(default=15, ge=0, le=480)
    image_url: str | None = None
    is_available: bool = True
    display_order: int = 0
    tax_config_ids: list[str] = Field(default_factory=list)


class MenuItemUpdate(BaseModel):
    category_id: str | None = None
    name: str | None = Field(default=None, min_length=2, max_length=180)
    price: Decimal | None = None
    description: str | None = None
    description_short: str | None = Field(default=None, max_length=255)
    dietary_tags: list[str] | None = None
    preparation_time_minutes: int | None = Field(default=None, ge=0, le=480)
    image_url: str | None = None
    is_available: bool | None = None
    display_order: int | None = None
    tax_config_ids: list[str] | None = None


class MenuItemRead(ORMModel):
    id: str
    hotel_id: str
    category_id: str
    name: str
    price: Decimal
    description: str | None = None
    description_short: str | None = None
    dietary_tags: list[str]
    preparation_time_minutes: int
    image_url: str | None = None
    is_available: bool
    display_order: int
    tax_config_ids: list[str] = Field(default_factory=list)

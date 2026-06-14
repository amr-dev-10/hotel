from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RoomTypeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None
    max_occupancy: int = 2
    base_price: Decimal = Decimal("0")
    amenities: list[str] = Field(default_factory=list)
    is_active: bool = True
    sort_order: int = 0


class RoomTypeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    max_occupancy: int | None = None
    base_price: Decimal | None = None
    amenities: list[str] | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class RoomTypeRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    description: str | None = None
    max_occupancy: int
    base_price: Decimal
    amenities: list[str]
    is_active: bool
    sort_order: int


class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=40)
    room_type_id: str | None = None
    room_type: str | None = None
    floor: str | None = None
    status: str = "available"
    notes: str | None = None


class RoomRead(ORMModel):
    id: str
    hotel_id: str
    room_type_id: str | None = None
    room_number: str
    room_type: str | None = None
    floor: str | None = None
    status: str
    notes: str | None = None

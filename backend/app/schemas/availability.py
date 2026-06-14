from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RoomBlockCreate(BaseModel):
    room_id: str | None = None
    room_type_id: str | None = None
    start_date: date
    end_date: date
    block_type: str = "owner_block"
    reference_type: str = "manual"
    reference_id: str | None = None
    notes: str | None = None


class RoomBlockRead(ORMModel):
    id: str
    hotel_id: str
    room_id: str | None = None
    room_type_id: str | None = None
    start_date: date
    end_date: date
    block_type: str
    reference_type: str | None = None
    reference_id: str | None = None
    notes: str | None = None
    created_by: str | None = None
    created_at: datetime


class AvailabilityQuery(BaseModel):
    room_type_id: str
    start_date: date
    end_date: date
    count: int = Field(default=1, gt=0)

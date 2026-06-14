from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=40)
    room_type: str | None = None
    floor: str | None = None
    status: str = "available"


class RoomRead(ORMModel):
    id: str
    hotel_id: str
    room_number: str
    room_type: str | None = None
    floor: str | None = None
    status: str

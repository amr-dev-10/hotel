from pydantic import BaseModel, Field


class RoomCreate(BaseModel):
    room_number: str = Field(min_length=1, max_length=40)
    room_type: str | None = Field(default=None, max_length=80)
    status: str = Field(default="available", max_length=40)


class RoomUpdate(BaseModel):
    room_number: str | None = Field(default=None, min_length=1, max_length=40)
    room_type: str | None = Field(default=None, max_length=80)
    status: str | None = Field(default=None, max_length=40)


class RoomRead(BaseModel):
    id: str
    hotel_id: str
    room_number: str
    room_type: str | None
    status: str

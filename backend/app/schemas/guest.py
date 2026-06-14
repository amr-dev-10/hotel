from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class GuestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    room_id: str | None = None
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    status: str = "checked_in"


class GuestRead(ORMModel):
    id: str
    hotel_id: str
    room_id: str | None = None
    name: str
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    status: str

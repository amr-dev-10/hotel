from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ReservationCreate(BaseModel):
    guest_name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    whatsapp_phone: str | None = None
    room_id: str | None = None
    checkin_date: date
    checkout_date: date
    source: str = "walk_in"


class ReservationRead(ORMModel):
    id: str
    hotel_id: str
    reservation_no: str
    guest_id: str
    room_id: str | None = None
    status: str
    checkin_date: date
    checkout_date: date
    source: str


class StayRecordRead(ORMModel):
    id: str
    hotel_id: str
    reservation_id: str
    room_id: str | None = None
    actual_checkin: datetime | None = None
    actual_checkout: datetime | None = None

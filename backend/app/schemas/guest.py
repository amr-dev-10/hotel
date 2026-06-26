from datetime import date

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class GuestCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    status: str = "checked_in"


class GuestRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    status: str
    internal_notes: str | None = None


class GuestListItem(GuestRead):
    reservation_count: int = 0
    has_whatsapp_conversation: bool = False


class GuestDetail(GuestRead):
    pass

class GuestUpdate(BaseModel):
    name: str | None = Field(min_length=2, max_length=255, default=None)
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: str | None = None
    check_in_date: date | None = None
    check_out_date: date | None = None
    status: str | None = None
    internal_notes: str | None = None

class TimelineEvent(BaseModel):
    event_type: str # 'reservation', 'whatsapp_message', 'ticket'
    timestamp: str
    id: str
    title: str
    description: str | None = None
    status: str | None = None
    metadata: dict | None = None

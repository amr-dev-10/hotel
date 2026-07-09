from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ReservationGuestCreate(BaseModel):
    guest_id: str
    is_primary: bool = False
    relationship: str | None = None


class ReservationRoomTypeCreate(BaseModel):
    room_type_id: str
    quantity: int = Field(default=1, gt=0)
    rate_plan_id: str | None = None


class ReservationCreate(BaseModel):
    guest_name: str | None = Field(default=None, min_length=2, max_length=255)
    phone: str | None = None
    whatsapp_phone: str | None = None
    room_id: str | None = None
    rate_plan_id: str | None = None
    room_type_id: str | None = None
    checkin_date: date
    checkout_date: date
    source: str = "walk_in"
    notes: str | None = None
    guests: list[ReservationGuestCreate] = Field(default_factory=list)
    room_types: list[ReservationRoomTypeCreate] = Field(default_factory=list)


class ReservationUpdate(BaseModel):
    room_id: str | None = None
    rate_plan_id: str | None = None
    status: str | None = None
    checkin_date: date | None = None
    checkout_date: date | None = None
    source: str | None = None
    notes: str | None = None


class ReservationCancelRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class ReservationRead(ORMModel):
    id: str
    hotel_id: str
    reservation_no: str
    guest_id: str
    room_id: str | None = None
    rate_plan_id: str | None = None
    status: str
    checkin_date: date
    checkout_date: date
    source: str
    notes: str | None = None
    cancelled_at: datetime | None = None
    cancelled_by: str | None = None
    cancellation_reason: str | None = None


class ReservationListItem(ReservationRead):
    guest_name: str | None = None
    guest_phone: str | None = None
    room_number: str | None = None
    room_type: str | None = None


class ReservationDetail(ReservationRead):
    guest_name: str | None = None
    guest_phone: str | None = None
    guest_whatsapp_phone: str | None = None
    room_number: str | None = None
    room_type: str | None = None


class ReservationGuestNew(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    phone: str | None = None
    whatsapp_phone: str | None = None
    email: str | None = None
    is_primary: bool = False
    relationship: str | None = None


class ReservationGuestRead(ORMModel):
    id: str
    hotel_id: str
    reservation_id: str
    guest_id: str
    guest_name: str | None = None
    guest_phone: str | None = None
    guest_whatsapp_phone: str | None = None
    is_primary: bool
    relationship: str | None = None
    added_at: datetime


class ReservationRoomTypeRead(ORMModel):
    id: str
    hotel_id: str
    reservation_id: str
    room_type_id: str
    room_type_name: str | None = None
    quantity: int
    rate_plan_id: str | None = None
    assigned_room_id: str | None = None
    assigned_room_number: str | None = None
    assigned_room_type: str | None = None
    assigned_at: datetime | None = None


class ReservationRoomAssignment(BaseModel):
    reservation_room_type_id: str
    room_id: str


class ReservationCheckInRequest(BaseModel):
    auto_assign: bool = False
    room_assignments: list[ReservationRoomAssignment] = Field(default_factory=list)


class RoomChangeRequest(BaseModel):
    new_room_id: str
    reason: str | None = None


class StayRecordRead(ORMModel):
    id: str
    hotel_id: str
    reservation_id: str
    room_id: str | None = None
    room_number: str | None = None
    room_type: str | None = None
    actual_checkin: datetime | None = None
    actual_checkout: datetime | None = None
    notes: str | None = None

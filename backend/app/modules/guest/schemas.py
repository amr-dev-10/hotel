from pydantic import BaseModel, Field


class GuestCreate(BaseModel):
    room_id: str | None = None
    name: str = Field(min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    whatsapp_phone: str | None = Field(default=None, max_length=40)
    check_in_date: str | None = Field(default=None, max_length=40)
    check_out_date: str | None = Field(default=None, max_length=40)
    status: str = Field(default="checked_in", max_length=40)


class GuestUpdate(BaseModel):
    room_id: str | None = None
    name: str | None = Field(default=None, min_length=1, max_length=160)
    phone: str | None = Field(default=None, max_length=40)
    whatsapp_phone: str | None = Field(default=None, max_length=40)
    check_in_date: str | None = Field(default=None, max_length=40)
    check_out_date: str | None = Field(default=None, max_length=40)
    status: str | None = Field(default=None, max_length=40)


class GuestRead(BaseModel):
    id: str
    hotel_id: str
    room_id: str | None
    name: str
    phone: str | None
    whatsapp_phone: str | None
    check_in_date: str | None
    check_out_date: str | None
    status: str

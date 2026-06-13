from pydantic import BaseModel, EmailStr, Field

from app.modules.tenant.models import TenantStatus


class HotelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    subdomain: str | None = Field(default=None, min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    address: str | None = Field(default=None, max_length=255)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    timezone: str = Field(default="UTC", max_length=80)
    subscription: str = Field(default="trial", max_length=80)
    status: TenantStatus = TenantStatus.ACTIVE


class HotelUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    address: str | None = Field(default=None, max_length=255)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, max_length=40)
    timezone: str | None = Field(default=None, max_length=80)
    subscription: str | None = Field(default=None, max_length=80)
    status: TenantStatus | None = None
    owner_user_id: str | None = None


class HotelRead(BaseModel):
    id: str
    name: str
    subdomain: str
    address: str | None
    contact_email: str | None
    contact_phone: str | None
    timezone: str
    subscription: str
    status: TenantStatus
    owner_user_id: str | None

    model_config = {"from_attributes": True}


class HotelStats(BaseModel):
    total_staff: int
    total_rooms: int
    occupied_rooms: int
    active_guests: int
    open_tickets: int
    closed_tickets: int
    feedback_count: int

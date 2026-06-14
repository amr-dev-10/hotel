from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class HotelBootstrapRequest(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=255)
    owner_name: str = Field(min_length=2, max_length=255)
    owner_email: EmailStr
    owner_password: str = Field(min_length=8)
    address: str | None = None
    timezone: str = "UTC"
    contact_phone: str | None = None
    whatsapp_phone_number_id: str | None = None
    seed_rooms: list[str] = Field(default_factory=list)


class HotelCreate(BaseModel):
    slug: str = Field(min_length=2, max_length=80)
    name: str = Field(min_length=2, max_length=255)
    address: str | None = None
    timezone: str = "UTC"
    contact_email: EmailStr | None = None
    contact_phone: str | None = None
    whatsapp_phone_number_id: str | None = None


class HotelRead(ORMModel):
    id: str
    slug: str
    name: str
    address: str | None = None
    timezone: str
    contact_email: str | None = None
    contact_phone: str | None = None
    whatsapp_phone_number_id: str | None = None
    subscription_tier: str
    status: str
    owner_user_id: str | None = None


class BootstrapResponse(BaseModel):
    hotel: HotelRead
    owner: dict
    access_token: str
    token_type: str = "bearer"

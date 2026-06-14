from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel
from app.schemas.hotel import HotelRead


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=120)
    logo_url: str | None = None
    contact_email: EmailStr | None = None


class OrganizationRead(ORMModel):
    id: str
    name: str
    slug: str
    logo_url: str | None = None
    contact_email: EmailStr | None = None


class OrganizationHotelAdd(BaseModel):
    hotel_id: str
    role: str = "managed"


class OrganizationHotelRead(BaseModel):
    organization_id: str
    hotel_id: str
    role: str
    hotel: HotelRead | None = None

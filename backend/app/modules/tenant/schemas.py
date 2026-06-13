from pydantic import BaseModel, EmailStr, Field

from app.modules.tenant.models import TenantStatus


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    subdomain: str = Field(min_length=2, max_length=80, pattern=r"^[a-z0-9-]+$")
    email: EmailStr | None = None
    phone: str | None = None


class TenantRead(BaseModel):
    id: str
    name: str
    subdomain: str
    email: str | None
    phone: str | None
    status: TenantStatus

    model_config = {"from_attributes": True}

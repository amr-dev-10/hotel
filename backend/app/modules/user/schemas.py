from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = Field(default=None, max_length=160)
    department: str | None = Field(default=None, max_length=120)
    job_role: str | None = Field(default=None, max_length=120)
    profile_image_url: str | None = Field(default=None, max_length=500)
    is_hotel_owner: bool = False
    is_on_duty: bool = True


class UserRead(BaseModel):
    id: str
    tenant_id: str
    name: str | None
    email: str
    department: str | None
    job_role: str | None
    profile_image_url: str | None
    is_hotel_owner: bool
    is_active: bool
    is_on_duty: bool

    model_config = {"from_attributes": True}


class StaffCreate(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    department: str | None = Field(default=None, max_length=120)
    job_role: str | None = Field(default=None, max_length=120)
    profile_image_url: str | None = Field(default=None, max_length=500)
    is_hotel_owner: bool = False
    is_active: bool = True
    is_on_duty: bool = True


class StaffUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)
    department: str | None = Field(default=None, max_length=120)
    job_role: str | None = Field(default=None, max_length=120)
    profile_image_url: str | None = Field(default=None, max_length=500)
    is_hotel_owner: bool | None = None
    is_active: bool | None = None
    is_on_duty: bool | None = None


class StaffRead(BaseModel):
    id: str
    hotel_id: str
    name: str | None
    email: str
    department: str | None
    job_role: str | None
    profile_image_url: str | None
    is_hotel_owner: bool
    is_active: bool
    is_on_duty: bool

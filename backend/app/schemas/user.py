from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8)
    department_id: str | None = None
    job_role: str | None = None
    is_on_duty: bool = False


class UserRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str | None = None
    name: str
    email: EmailStr
    job_role: str | None = None
    is_hotel_owner: bool
    is_active: bool
    is_on_duty: bool

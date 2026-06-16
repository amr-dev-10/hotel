from datetime import datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel
from app.schemas.rbac import RoleRead


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8)
    department_id: str | None = None
    reports_to: str | None = None
    staff_level: str | None = Field(default=None, max_length=20)
    user_type: str | None = Field(default=None, max_length=30)
    job_role: str | None = None
    is_on_duty: bool = False


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    department_id: str | None = None
    reports_to: str | None = None
    staff_level: str | None = Field(default=None, max_length=20)
    user_type: str | None = Field(default=None, max_length=30)
    job_role: str | None = None
    is_active: bool | None = None
    is_on_duty: bool | None = None
    role_id: str | None = None
    role_ids: list[str] | None = None


class UserRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str | None = None
    reports_to: str | None = None
    user_type: str
    staff_level: str | None = None
    name: str
    email: EmailStr
    job_role: str | None = None
    is_hotel_owner: bool
    is_active: bool
    is_on_duty: bool
    is_deleted: bool = False
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    roles: list[RoleRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

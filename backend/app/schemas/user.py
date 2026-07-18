from datetime import datetime
import re

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.common import ORMModel
from app.schemas.rbac import RoleRead


EMPLOYEE_CODE_PATTERN = re.compile(r"^[A-Z0-9]+$")


def normalize_employee_code(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().upper()
    if not normalized:
        return None
    if not EMPLOYEE_CODE_PATTERN.fullmatch(normalized):
        raise ValueError("Employee code can only contain letters and numbers")
    return normalized


class EmployeeCodeGenerateRequest(BaseModel):
    staff_level: str | None = Field(default=None, max_length=40)
    job_role: str | None = Field(default=None, max_length=120)


class EmployeeCodeGenerateResponse(BaseModel):
    employee_code: str


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8)
    employee_code: str | None = Field(default=None, max_length=40)
    department_id: str | None = None
    reports_to: str | None = None
    staff_level: str | None = Field(default=None, max_length=20)
    user_type: str | None = Field(default=None, max_length=30)
    job_role: str | None = None
    is_on_duty: bool = False

    @field_validator("employee_code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        return normalize_employee_code(value)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    email: EmailStr | None = None
    employee_code: str | None = Field(default=None, max_length=40)
    department_id: str | None = None
    reports_to: str | None = None
    staff_level: str | None = Field(default=None, max_length=20)
    user_type: str | None = Field(default=None, max_length=30)
    job_role: str | None = None
    is_active: bool | None = None
    is_on_duty: bool | None = None
    role_id: str | None = None
    role_ids: list[str] | None = None

    @field_validator("employee_code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        return normalize_employee_code(value)


class UserPasswordReset(BaseModel):
    new_password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)

    @model_validator(mode="after")
    def passwords_match(self) -> "UserPasswordReset":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match")
        return self


class UserRead(ORMModel):
    id: str
    hotel_id: str
    employee_code: str | None = None
    department_id: str | None = None
    reports_to: str | None = None
    user_type: str
    staff_level: str | None = None
    name: str
    email: EmailStr
    job_role: str | None = None
    profile_image_url: str | None = None
    is_hotel_owner: bool
    is_active: bool
    is_on_duty: bool
    is_deleted: bool = False
    deleted_at: datetime | None = None
    deleted_by: str | None = None
    roles: list[RoleRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int


class CurrentUserRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str | None = None
    name: str
    email: EmailStr
    job_role: str | None = None
    is_hotel_owner: bool
    is_on_duty: bool

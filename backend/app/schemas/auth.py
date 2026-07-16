from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.common import ORMModel
from app.schemas.ops import MediaFileCreate


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=6)

    @field_validator("email")
    @classmethod
    def normalize_identifier(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Enter your email or employee code")
        return normalized


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"
    expires_in_minutes: int


class CurrentUserRead(ORMModel):
    id: str
    hotel_id: str
    employee_code: str | None = None
    department_id: str | None = None
    name: str
    email: EmailStr
    user_type: str
    staff_level: str | None = None
    job_role: str | None = None
    profile_image_url: str | None = None
    is_hotel_owner: bool
    is_on_duty: bool
    permissions: list[str] = Field(default_factory=list)
    permission_scopes: dict[str, str] = Field(default_factory=dict)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=20)
    device_info: str | None = None


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class ProfileUpdateRequest(BaseModel):
    email: EmailStr | None = None


class ProfileImageUploadRequest(MediaFileCreate):
    pass


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8)
    confirm_password: str = Field(min_length=8)

    @model_validator(mode="after")
    def passwords_match(self) -> "PasswordChangeRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("New password and confirmation do not match")
        return self

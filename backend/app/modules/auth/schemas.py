from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    tenant_subdomain: str | None = None
    hotel_id: str | None = None
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class GuestOtpRequest(BaseModel):
    hotel_id: str
    phone: str


class GuestOtpResponse(BaseModel):
    otp_sent: bool
    phone: str
    dev_otp: str | None = None


class GuestOtpConfirm(BaseModel):
    hotel_id: str
    phone: str
    otp: str

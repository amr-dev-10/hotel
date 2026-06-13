from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, verify_password
from app.database.session import get_db
from app.modules.auth.models import RefreshToken
from app.modules.auth.schemas import (
    GuestOtpConfirm,
    GuestOtpRequest,
    GuestOtpResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    TokenResponse,
)
from app.modules.guest.models import Guest
from app.modules.role.models import UserRole
from app.modules.tenant.models import Tenant
from app.modules.user.models import User

router = APIRouter(prefix="/auth", tags=["auth"])


def _hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def _issue_refresh_token(db: Session, tenant_id: str, user_id: str) -> str:
    raw_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            tenant_id=tenant_id,
            user_id=user_id,
            token_hash=_hash_token(raw_token),
            expires_at=datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days),
        )
    )
    return raw_token


def _tenant_from_login(db: Session, payload: LoginRequest) -> Tenant:
    if payload.hotel_id is not None:
        tenant = db.scalar(select(Tenant).where(Tenant.id == payload.hotel_id))
    elif payload.tenant_subdomain is not None:
        tenant = db.scalar(select(Tenant).where(Tenant.subdomain == payload.tenant_subdomain))
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="hotel_id or tenant_subdomain is required")
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return tenant


def _role_ids_for_user(db: Session, tenant_id: str, user_id: str) -> list[str]:
    return list(
        db.scalars(
            select(UserRole.role_id).where(
                UserRole.tenant_id == tenant_id,
                UserRole.user_id == user_id,
            )
        ).all()
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    tenant = _tenant_from_login(db, payload)

    user = db.scalar(
        select(User).where(
            User.tenant_id == tenant.id,
            User.email == payload.email,
            User.is_active.is_(True),
        )
    )
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role_ids = _role_ids_for_user(db, tenant.id, user.id)
    refresh_token = _issue_refresh_token(db, tenant.id, user.id)
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user_id=user.id, tenant_id=tenant.id, role_ids=role_ids),
        refresh_token=refresh_token,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == _hash_token(payload.refresh_token),
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.scalar(select(User).where(User.id == token.user_id, User.tenant_id == token.tenant_id, User.is_active.is_(True)))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    role_ids = _role_ids_for_user(db, token.tenant_id, token.user_id)
    return TokenResponse(
        access_token=create_access_token(user_id=user.id, tenant_id=token.tenant_id, role_ids=role_ids),
        refresh_token=payload.refresh_token,
    )


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)) -> dict[str, bool]:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == _hash_token(payload.refresh_token)))
    if token is not None:
        token.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return {"logged_out": True}


@router.post("/guest/verify-phone", response_model=GuestOtpResponse)
def verify_guest_phone(payload: GuestOtpRequest, db: Session = Depends(get_db)) -> GuestOtpResponse:
    tenant = db.scalar(select(Tenant).where(Tenant.id == payload.hotel_id))
    if tenant is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")
    return GuestOtpResponse(otp_sent=True, phone=payload.phone, dev_otp=settings.guest_otp_code)


@router.post("/guest/confirm-otp", response_model=TokenResponse)
def confirm_guest_otp(payload: GuestOtpConfirm, db: Session = Depends(get_db)) -> TokenResponse:
    if payload.otp != settings.guest_otp_code:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OTP")
    guest = db.scalar(
        select(Guest).where(
            Guest.tenant_id == payload.hotel_id,
            or_(Guest.phone == payload.phone, Guest.whatsapp_phone == payload.phone),
        )
    )
    if guest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
    return TokenResponse(access_token=create_access_token(user_id=guest.id, tenant_id=payload.hotel_id, role_ids=[]))

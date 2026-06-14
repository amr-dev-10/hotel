from datetime import UTC, datetime, timedelta
import hashlib
import hmac
from typing import Any

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

from app.core.config import settings

password_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_access_token(
    subject: str,
    hotel_id: str,
    claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    now = datetime.now(UTC)
    expire = now + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    payload: dict[str, Any] = {
        "sub": subject,
        "hotel_id": hotel_id,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    if claims:
        payload.update(claims)
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def verify_meta_signature(
    raw_body: bytes,
    signature_header: str | None,
    app_secret: str | None = None,
) -> bool:
    secret = app_secret or settings.whatsapp_app_secret
    if not secret:
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    received = signature_header.removeprefix("sha256=")
    return hmac.compare_digest(expected, received)

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import jwt
from passlib.context import CryptContext

from app.core.config import settings

password_context = CryptContext(schemes=["argon2"], deprecated="auto")


def hash_password(password: str) -> str:
    return password_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return password_context.verify(password, password_hash)


def create_access_token(
    *,
    user_id: UUID,
    tenant_id: UUID | None = None,
    role_ids: list[UUID] | None = None,
    platform_admin: bool = False,
) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "exp": expires_at,
    }

    if platform_admin:
        payload["platform_admin"] = True
    else:
        payload["tenant_id"] = str(tenant_id)
        payload["role_ids"] = [str(role_id) for role_id in role_ids or []]

    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)

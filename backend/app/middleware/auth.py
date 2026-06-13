from dataclasses import dataclass
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.modules.subscription.models import Subscription
from app.modules.tenant.models import Tenant, TenantStatus

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class TenantContext:
    user_id: UUID
    tenant_id: UUID
    role_ids: list[UUID]


@dataclass(frozen=True)
class PlatformContext:
    user_id: UUID


def _decode_token(credentials: HTTPAuthorizationCredentials | None) -> dict:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    try:
        return jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc


def require_tenant_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> TenantContext:
    payload = _decode_token(credentials)
    if payload.get("platform_admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant token required")

    tenant_id = UUID(payload["tenant_id"])
    tenant = db.scalar(select(Tenant).where(Tenant.id == str(tenant_id)))
    if tenant is None or tenant.status != TenantStatus.ACTIVE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant is not active")

    return TenantContext(
        user_id=UUID(payload["sub"]),
        tenant_id=tenant_id,
        role_ids=[UUID(role_id) for role_id in payload.get("role_ids", [])],
    )


def require_platform_context(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> PlatformContext:
    payload = _decode_token(credentials)
    if payload.get("platform_admin") is not True:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform admin token required")
    return PlatformContext(user_id=UUID(payload["sub"]))


def require_subscription(
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> TenantContext:
    subscription = db.scalar(
        select(Subscription).where(
            Subscription.tenant_id == str(context.tenant_id),
            Subscription.status == "active",
        )
    )
    if subscription is None:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Active subscription required")
    return context

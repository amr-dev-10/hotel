from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import PlatformContext, require_platform_context
from app.modules.tenant.models import Tenant
from app.modules.tenant.schemas import TenantCreate, TenantRead

router = APIRouter(prefix="/platform/tenants", tags=["platform tenants"])


@router.get("", response_model=list[TenantRead])
def list_tenants(
    _: PlatformContext = Depends(require_platform_context),
    db: Session = Depends(get_db),
) -> list[Tenant]:
    return list(db.scalars(select(Tenant).order_by(Tenant.created_at.desc())).all())


@router.post("", response_model=TenantRead, status_code=201)
def create_tenant(
    payload: TenantCreate,
    _: PlatformContext = Depends(require_platform_context),
    db: Session = Depends(get_db),
) -> Tenant:
    tenant = Tenant(**payload.model_dump())
    db.add(tenant)
    db.commit()
    db.refresh(tenant)
    return tenant

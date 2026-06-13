from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.permission.models import Permission
from app.modules.permission.schemas import PermissionCreate, PermissionRead

router = APIRouter(prefix="/permissions", tags=["permissions"])


@router.get("", response_model=list[PermissionRead])
def list_permissions(
    context: TenantContext = Depends(require_permission("permission.view")),
    db: Session = Depends(get_db),
) -> list[Permission]:
    return list(db.scalars(select(Permission).where(Permission.tenant_id == str(context.tenant_id))).all())


@router.post("", response_model=PermissionRead, status_code=201)
def create_permission(
    payload: PermissionCreate,
    context: TenantContext = Depends(require_permission("permission.create")),
    db: Session = Depends(get_db),
) -> Permission:
    permission = Permission(tenant_id=str(context.tenant_id), **payload.model_dump())
    db.add(permission)
    db.commit()
    db.refresh(permission)
    return permission

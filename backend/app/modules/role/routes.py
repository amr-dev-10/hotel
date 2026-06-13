from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.role.models import Role
from app.modules.role.schemas import RoleCreate, RoleRead

router = APIRouter(prefix="/roles", tags=["roles"])


@router.get("", response_model=list[RoleRead])
def list_roles(
    context: TenantContext = Depends(require_permission("role.view")),
    db: Session = Depends(get_db),
) -> list[Role]:
    return list(db.scalars(select(Role).where(Role.tenant_id == str(context.tenant_id))).all())


@router.post("", response_model=RoleRead, status_code=201)
def create_role(
    payload: RoleCreate,
    context: TenantContext = Depends(require_permission("role.create")),
    db: Session = Depends(get_db),
) -> Role:
    role = Role(tenant_id=str(context.tenant_id), **payload.model_dump())
    db.add(role)
    db.commit()
    db.refresh(role)
    return role

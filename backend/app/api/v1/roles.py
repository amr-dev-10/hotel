from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.rbac_repository import PermissionGroupRepository, PermissionRepository, RoleRepository
from app.schemas.rbac import (
    PermissionGroupRead,
    PermissionRead,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    UserRoleAssign,
)
from app.services.rbac_service import RBACService

router = APIRouter()


@router.get("/permissions")
def list_permissions(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.view")),
) -> dict:
    permissions = PermissionRepository(db).list_all()
    return ok([PermissionRead.model_validate(item).model_dump() for item in permissions])


@router.get("/permission-groups")
def list_permission_groups(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.view")),
) -> dict:
    RBACService(db).seed_permissions()
    groups = PermissionGroupRepository(db).list_all()
    return ok([PermissionGroupRead.model_validate(item).model_dump() for item in groups])


@router.get("")
def list_roles(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.view")),
) -> dict:
    roles = RoleRepository(db).list_for_hotel(hotel_id)
    return ok([RoleRead.model_validate(item).model_dump() for item in roles])


@router.post("")
def create_role(
    hotel_id: str,
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.manage")),
) -> dict:
    role = RBACService(db).create_role(
        hotel_id,
        payload.name,
        payload.description,
        payload.permission_codes,
        current_user.id,
    )
    return ok(RoleRead.model_validate(role).model_dump())


@router.post("/users/{user_id}")
def assign_user_roles(
    hotel_id: str,
    user_id: str,
    payload: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.manage")),
) -> dict:
    RBACService(db).assign_roles(hotel_id, user_id, payload.role_ids, current_user.id)
    return ok({"assigned": True, "user_id": user_id, "role_ids": payload.role_ids})


@router.put("/{role_id}")
def update_role(
    hotel_id: str,
    role_id: str,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.manage")),
) -> dict:
    role = RBACService(db).update_role(
        hotel_id,
        role_id,
        payload.name,
        payload.description,
        payload.permission_codes,
        current_user.id,
    )
    return ok(RoleRead.model_validate(role).model_dump())


@router.delete("/{role_id}")
def delete_role(
    hotel_id: str,
    role_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("role.manage")),
) -> dict:
    RBACService(db).delete_role(hotel_id, role_id, current_user.id)
    return ok({"deleted": True, "role_id": role_id})

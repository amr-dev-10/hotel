from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_any_permission, require_permission
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.rbac import UserRoleAssign
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.rbac_service import RBACService
from app.services.user_service import ADMIN_USER_TYPE, EMPLOYEE_USER_TYPE, UserService

router = APIRouter()


@router.get("")
def list_users(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.view")),
) -> dict:
    users = UserRepository(db).list_for_hotel(hotel_id)
    return ok([UserRead.model_validate(item).model_dump() for item in users])


@router.post("")
def create_user(
    hotel_id: str,
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("user.create", "user.manage")),
) -> dict:
    repo = UserRepository(db)
    if repo.get_by_hotel_email(hotel_id, payload.email):
        raise bad_request("User email already exists for this hotel")
    user = User(
        hotel_id=hotel_id,
        name=payload.name,
        email=payload.email,
        hashed_password=AuthService.password_hash(payload.password),
        department_id=payload.department_id,
        reports_to=payload.reports_to,
        user_type=payload.user_type or (ADMIN_USER_TYPE if payload.staff_level == "admin" else EMPLOYEE_USER_TYPE),
        staff_level=payload.staff_level,
        job_role=payload.job_role,
        is_hotel_owner=False,
        is_active=True,
        is_on_duty=payload.is_on_duty,
    )
    repo.add(user)
    AuditService(db).log(
        hotel_id,
        "user.created",
        "user",
        user.id,
        current_user.id,
        {"name": user.name, "email": user.email, "user_type": user.user_type},
        commit=True,
    )
    return ok(UserRead.model_validate(user).model_dump())


@router.get("/{user_id}")
def get_user(
    hotel_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.view")),
) -> dict:
    user = UserService(db).get_user(hotel_id, user_id)
    return ok(UserRead.model_validate(user).model_dump())


@router.patch("/{user_id}")
def update_user(
    hotel_id: str,
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("user.update", "user.manage")),
) -> dict:
    user = UserService(db).update_user(hotel_id, user_id, payload, current_user)
    return ok(UserRead.model_validate(user).model_dump())


@router.delete("/{user_id}")
def delete_user(
    hotel_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.delete")),
) -> dict:
    UserService(db).delete_user(hotel_id, user_id, current_user)
    return ok({"deleted": True, "user_id": user_id})


@router.post("/{user_id}/roles")
def assign_roles_to_user(
    hotel_id: str,
    user_id: str,
    payload: UserRoleAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("user.manage")),
) -> dict:
    RBACService(db).assign_roles(hotel_id, user_id, payload.role_ids, current_user.id)
    return ok({"assigned": True, "user_id": user_id, "role_ids": payload.role_ids})

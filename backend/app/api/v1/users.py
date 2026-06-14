from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.rbac import UserRoleAssign
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService
from app.services.rbac_service import RBACService

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
    current_user: User = Depends(require_permission("user.manage")),
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
        job_role=payload.job_role,
        is_hotel_owner=False,
        is_active=True,
        is_on_duty=payload.is_on_duty,
    )
    repo.add(user)
    return ok(UserRead.model_validate(user).model_dump())


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

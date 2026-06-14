from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter()


@router.get("")
def list_users(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    users = UserRepository(db).list_for_hotel(hotel_id)
    return ok([UserRead.model_validate(item).model_dump() for item in users])


@router.post("")
def create_user(
    hotel_id: str,
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
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

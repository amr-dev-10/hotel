from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.user.models import User
from app.modules.user.schemas import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserRead])
def list_users(
    context: TenantContext = Depends(require_permission("user.view")),
    db: Session = Depends(get_db),
) -> list[User]:
    return list(db.scalars(select(User).where(User.tenant_id == str(context.tenant_id))).all())


@router.post("", response_model=UserRead, status_code=201)
def create_user(
    payload: UserCreate,
    context: TenantContext = Depends(require_permission("user.create")),
    db: Session = Depends(get_db),
) -> User:
    user = User(
        tenant_id=str(context.tenant_id),
        email=payload.email,
        password_hash=hash_password(payload.password),
        name=payload.name,
        department=payload.department,
        job_role=payload.job_role,
        profile_image_url=payload.profile_image_url,
        is_hotel_owner=payload.is_hotel_owner,
        is_on_duty=payload.is_on_duty,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.hotel.dependencies import ensure_hotel_scope
from app.modules.user.models import User
from app.modules.user.schemas import StaffCreate, StaffRead, StaffUpdate

router = APIRouter(prefix="/hotels/{hotel_id}/users", tags=["hotel users"])


def _staff_to_read(user: User) -> StaffRead:
    return StaffRead(
        id=user.id,
        hotel_id=user.tenant_id,
        name=user.name,
        email=user.email,
        department=user.department,
        job_role=user.job_role,
        profile_image_url=user.profile_image_url,
        is_hotel_owner=user.is_hotel_owner,
        is_active=user.is_active,
    )


def _get_staff(db: Session, hotel_id: str, user_id: str) -> User:
    user = db.scalar(select(User).where(User.tenant_id == hotel_id, User.id == user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return user


@router.get("", response_model=list[StaffRead])
def list_staff(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[StaffRead]:
    ensure_hotel_scope(hotel_id, context)
    users = db.scalars(select(User).where(User.tenant_id == hotel_id).order_by(User.created_at.desc())).all()
    return [_staff_to_read(user) for user in users]


@router.post("", response_model=StaffRead, status_code=201)
def create_staff(
    hotel_id: str,
    payload: StaffCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> StaffRead:
    ensure_hotel_scope(hotel_id, context)
    existing = db.scalar(select(User.id).where(User.tenant_id == hotel_id, User.email == payload.email))
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists for this hotel")
    user = User(
        tenant_id=hotel_id,
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        department=payload.department,
        job_role=payload.job_role,
        profile_image_url=payload.profile_image_url,
        is_hotel_owner=payload.is_hotel_owner,
        is_active=payload.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _staff_to_read(user)


@router.get("/me", response_model=StaffRead)
def get_me(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> StaffRead:
    ensure_hotel_scope(hotel_id, context)
    user = _get_staff(db, hotel_id, str(context.user_id))
    return _staff_to_read(user)


@router.get("/{user_id}", response_model=StaffRead)
def get_staff(
    hotel_id: str,
    user_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> StaffRead:
    ensure_hotel_scope(hotel_id, context)
    user = _get_staff(db, hotel_id, user_id)
    return _staff_to_read(user)


@router.put("/{user_id}", response_model=StaffRead)
def update_staff(
    hotel_id: str,
    user_id: str,
    payload: StaffUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> StaffRead:
    ensure_hotel_scope(hotel_id, context)
    user = _get_staff(db, hotel_id, user_id)
    updates = payload.model_dump(exclude_unset=True)
    password = updates.pop("password", None)
    if password is not None:
        user.password_hash = hash_password(password)
    for key, value in updates.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return _staff_to_read(user)


@router.delete("/{user_id}", status_code=204)
def delete_staff(
    hotel_id: str,
    user_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Response:
    ensure_hotel_scope(hotel_id, context)
    user = _get_staff(db, hotel_id, user_id)
    user.is_active = False
    db.commit()
    return Response(status_code=204)

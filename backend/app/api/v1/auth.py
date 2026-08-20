from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    CurrentUserRead,
    LoginRequest,
    LogoutRequest,
    PasswordChangeRequest,
    ProfileImageUploadRequest,
    ProfileUpdateRequest,
    RefreshTokenRequest,
)
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService
from app.services.ops_service import MediaService
from app.services.rbac_service import RBACService

router = APIRouter()


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = AuthService(db).authenticate(payload.email, payload.password)
    return ok(AuthService(db).token_for_user(user))


@router.post("/refresh")
def refresh_token(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
) -> dict:
    return ok(AuthService(db).refresh_access_token(payload.refresh_token, payload.device_info))


@router.post("/logout")
def logout(
    payload: LogoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    AuthService(db).logout(current_user, payload.refresh_token)
    return ok({"logged_out": True})


@router.post("/logout-all")
def logout_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    AuthService(db).logout_all(current_user)
    return ok({"logged_out": True})


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    AuthService(db).change_password(
        current_user,
        payload.current_password,
        payload.new_password,
    )
    return ok({"password_changed": True})


@router.patch("/me")
def update_me(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    update_data = payload.model_dump(exclude_unset=True)
    if "email" in update_data and update_data["email"]:
        if UserRepository(db).email_exists_for_other_user(current_user.hotel_id, update_data["email"], current_user.id):
            raise bad_request("User email already exists for this hotel")

    old_payload = {
        "email": current_user.email,
        "profile_image_url": current_user.profile_image_url,
    }
    if "email" in update_data:
        current_user.email = update_data["email"]

    AuditService(db).log(
        current_user.hotel_id,
        "user.profile_updated",
        "user",
        current_user.id,
        current_user.id,
        old_payload=old_payload,
        new_payload={"email": current_user.email, "profile_image_url": current_user.profile_image_url},
    )
    db.commit()
    db.refresh(current_user)
    return ok(_current_user_payload(db, current_user).model_dump())


@router.post("/me/profile-image")
def upload_profile_image(
    payload: ProfileImageUploadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not payload.file_type.startswith("image/"):
        raise bad_request("Profile image upload must be an image")
    media_service = MediaService(db)
    media = media_service.register_file(current_user.hotel_id, payload, current_user.id)
    old_payload = {"profile_image_url": current_user.profile_image_url}
    current_user.profile_image_url = media.file_url
    AuditService(db).log(
        current_user.hotel_id,
        "user.profile_image_updated",
        "user",
        current_user.id,
        current_user.id,
        old_payload=old_payload,
        new_payload={"profile_image_url": current_user.profile_image_url},
    )
    media_service.cleanup_removed_urls(current_user.hotel_id, old_payload, {"profile_image_url": current_user.profile_image_url})
    db.commit()
    db.refresh(current_user)
    return ok(_current_user_payload(db, current_user).model_dump())


@router.delete("/me/profile-image")
def delete_profile_image(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    media_service = MediaService(db)
    old_payload = {"profile_image_url": current_user.profile_image_url}
    current_user.profile_image_url = None
    AuditService(db).log(
        current_user.hotel_id,
        "user.profile_image_removed",
        "user",
        current_user.id,
        current_user.id,
        old_payload=old_payload,
        new_payload={"profile_image_url": None},
    )
    media_service.cleanup_removed_urls(current_user.hotel_id, old_payload, {"profile_image_url": None})
    db.commit()
    db.refresh(current_user)
    return ok(_current_user_payload(db, current_user).model_dump())


@router.get("/me")
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return ok(_current_user_payload(db, current_user).model_dump())


def _current_user_payload(db: Session, current_user: User) -> CurrentUserRead:
    rbac = RBACService(db)
    permissions = sorted(rbac.permission_codes_for_user(current_user))
    return CurrentUserRead.model_validate(current_user).model_copy(
        update={"permissions": permissions, "permission_scopes": rbac.permission_scopes_for_user(current_user)}
    )

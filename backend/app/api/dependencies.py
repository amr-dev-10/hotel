from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db, set_tenant_context
from app.core.exceptions import forbidden
from app.core.security import decode_access_token
from app.models.platform_admin import PlatformAdmin
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.rbac_service import RBACService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if payload.get("scope", "hotel") != "hotel":
        raise forbidden("Hotel access required. Platform tokens are not accepted here.")
    user_id = payload.get("sub")
    user = UserRepository(db).get(user_id) if user_id else None
    if not user or not user.is_active:
        raise forbidden("User is not active")
    return user


def get_platform_admin(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> PlatformAdmin:
    payload = decode_access_token(token)
    if payload.get("scope") != "platform":
        raise forbidden("Platform access required. Hotel tokens are not accepted here.")
    admin_id = payload.get("sub")
    admin = db.get(PlatformAdmin, admin_id) if admin_id else None
    if not admin or not admin.is_active:
        raise forbidden("Platform admin is not active")
    return admin


def ensure_hotel_access(hotel_id: str, user: User) -> None:
    if user.hotel_id != hotel_id:
        raise forbidden("Token hotel_id does not match requested hotel")


def require_permission(permission_code: str):
    def dependency(
        hotel_id: str,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        ensure_hotel_access(hotel_id, current_user)
        set_tenant_context(db, hotel_id)
        RBACService(db).require(current_user, permission_code)
        return current_user

    return dependency


def require_any_permission(*permission_codes: str):
    def dependency(
        hotel_id: str,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        ensure_hotel_access(hotel_id, current_user)
        set_tenant_context(db, hotel_id)
        rbac = RBACService(db)
        if current_user.is_hotel_owner:
            return current_user
        permissions = rbac.permission_codes_for_user(current_user)
        if not any(code in permissions for code in permission_codes):
            raise forbidden(f"Missing one of permissions: {', '.join(permission_codes)}")
        return current_user

    return dependency

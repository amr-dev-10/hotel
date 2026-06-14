from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import forbidden
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.services.rbac_service import RBACService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    user_id = payload.get("sub")
    user = UserRepository(db).get(user_id) if user_id else None
    if not user or not user.is_active:
        raise forbidden("User is not active")
    return user


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
        RBACService(db).require(current_user, permission_code)
        return current_user

    return dependency

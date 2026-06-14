from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.schemas.auth import CurrentUserRead, LoginRequest, LogoutRequest, RefreshTokenRequest
from app.services.auth_service import AuthService

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


@router.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return ok(CurrentUserRead.model_validate(current_user).model_dump())

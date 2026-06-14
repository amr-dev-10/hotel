from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.schemas.auth import CurrentUserRead, LoginRequest
from app.services.auth_service import AuthService

router = APIRouter()


@router.post("/login")
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = AuthService(db).authenticate(payload.email, payload.password)
    return ok(AuthService(db).token_for_user(user))


@router.get("/me")
def me(current_user: User = Depends(get_current_user)) -> dict:
    return ok(CurrentUserRead.model_validate(current_user).model_dump())

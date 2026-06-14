from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import bad_request
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)

    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(email)
        if not user or not user.is_active or not verify_password(password, user.hashed_password):
            raise bad_request("Invalid email or password")
        return user

    def token_for_user(self, user: User) -> dict:
        token = create_access_token(
            subject=user.id,
            hotel_id=user.hotel_id,
            claims={
                "email": user.email,
                "is_hotel_owner": user.is_hotel_owner,
                "department_id": user.department_id,
            },
        )
        return {
            "access_token": token,
            "token_type": "bearer",
            "expires_in_minutes": settings.access_token_expire_minutes,
        }

    @staticmethod
    def password_hash(password: str) -> str:
        return hash_password(password)

from datetime import timedelta
from secrets import token_urlsafe

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.exceptions import bad_request, forbidden
from app.models.base import utcnow
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User, UserSession
from app.repositories.user_repository import UserRepository, UserSessionRepository


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.users = UserRepository(db)
        self.sessions = UserSessionRepository(db)

    def authenticate(self, email: str, password: str) -> User:
        user = self.users.get_by_email(email)
        if not user or not user.is_active or not verify_password(password, user.hashed_password):
            raise bad_request("Invalid email or password")
        return user

    def token_for_user(
        self,
        user: User,
        device_info: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        token = create_access_token(
            subject=user.id,
            hotel_id=user.hotel_id,
            claims={
                "email": user.email,
                "is_hotel_owner": user.is_hotel_owner,
                "department_id": user.department_id,
            },
        )
        refresh_token = self._create_refresh_session(user, device_info, ip_address)
        return {
            "access_token": token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in_minutes": settings.access_token_expire_minutes,
        }

    def refresh_access_token(
        self,
        refresh_token: str,
        device_info: str | None = None,
        ip_address: str | None = None,
    ) -> dict:
        now = utcnow()
        for user in self.users.db.query(User).filter(User.is_active.is_(True)).all():
            for session in self.sessions.active_candidates(user.id, now):
                if verify_password(refresh_token, session.refresh_token_hash):
                    session.revoked_at = now
                    self.db.flush()
                    return self.token_for_user(user, device_info, ip_address)
        raise forbidden("Invalid or expired refresh token")

    def logout(self, user: User, refresh_token: str | None = None) -> None:
        now = utcnow()
        for session in self.sessions.active_for_user(user.id):
            if refresh_token is None or verify_password(refresh_token, session.refresh_token_hash):
                session.revoked_at = now
        self.db.commit()

    def logout_all(self, user: User) -> None:
        now = utcnow()
        for session in self.sessions.active_for_user(user.id):
            session.revoked_at = now
        self.db.commit()

    @staticmethod
    def password_hash(password: str) -> str:
        return hash_password(password)

    def _create_refresh_session(
        self,
        user: User,
        device_info: str | None,
        ip_address: str | None,
    ) -> str:
        refresh_token = token_urlsafe(48)
        session = UserSession(
            user_id=user.id,
            refresh_token_hash=hash_password(refresh_token),
            device_info=device_info,
            ip_address=ip_address,
            expires_at=utcnow() + timedelta(days=settings.refresh_token_expire_days),
        )
        self.db.add(session)
        self.db.commit()
        return refresh_token

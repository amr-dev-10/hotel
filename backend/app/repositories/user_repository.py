from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.user import FCMToken, User, UserSession
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, User)

    def list_for_hotel(
        self,
        hotel_id: str,
        limit: int = 200,
        cursor: str | None = None,
        q: str | None = None,
    ) -> Sequence[User]:
        statement = select(User).where(
            User.hotel_id == hotel_id,
            User.deleted_at.is_(None),
        )
        if cursor:
            statement = statement.where(User.id > cursor)
        if q:
            pattern = f"%{q.strip()}%"
            statement = statement.where(
                or_(
                    User.name.ilike(pattern),
                    User.email.ilike(pattern),
                    User.job_role.ilike(pattern),
                    User.staff_level.ilike(pattern),
                )
            )
        return self.db.execute(statement.order_by(User.name).limit(limit)).scalars().all()

    def get_by_email(self, email: str) -> User | None:
        return self.db.execute(
            select(User).where(User.email == email, User.deleted_at.is_(None))
        ).scalar_one_or_none()

    def get_by_hotel_email(self, hotel_id: str, email: str) -> User | None:
        return self.db.execute(
            select(User).where(
                User.hotel_id == hotel_id,
                User.email == email,
                User.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

    def list_for_department(self, hotel_id: str, department_id: str) -> Sequence[User]:
        return self.db.execute(
            select(User).where(
                User.hotel_id == hotel_id,
                User.department_id == department_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        ).scalars().all()

    def list_active_for_hotel(self, hotel_id: str) -> Sequence[User]:
        return self.db.execute(
            select(User).where(
                User.hotel_id == hotel_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        ).scalars().all()

    def get_active(self, user_id: str) -> User | None:
        return self.db.execute(
            select(User).where(
                User.id == user_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

    def count_hotel_admins(self, hotel_id: str) -> int:
        return self.db.execute(
            select(func.count())
            .select_from(User)
            .where(
                User.hotel_id == hotel_id,
                User.is_active.is_(True),
                User.deleted_at.is_(None),
                or_(
                    User.is_hotel_owner.is_(True),
                    User.user_type == "HOTEL_ADMIN",
                    User.staff_level == "admin",
                ),
            )
        ).scalar_one()

    def email_exists_for_other_user(self, hotel_id: str, email: str, user_id: str) -> bool:
        return (
            self.db.execute(
                select(User.id).where(
                    User.hotel_id == hotel_id,
                    User.email == email,
                    User.id != user_id,
                    User.deleted_at.is_(None),
                )
            ).scalar_one_or_none()
            is not None
        )

    def find_by_staff_level(
        self,
        hotel_id: str,
        staff_level: str,
        department_id: str | None = None,
    ) -> User | None:
        statement = select(User).where(
            User.hotel_id == hotel_id,
            User.staff_level == staff_level,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
        if department_id:
            statement = statement.where(User.department_id == department_id)
        return self.db.execute(statement.order_by(User.is_on_duty.desc(), User.updated_at)).scalars().first()

    def first_on_duty_for_department(
        self,
        hotel_id: str,
        department_id: str | None,
    ) -> User | None:
        statement = select(User).where(
            User.hotel_id == hotel_id,
            User.is_active.is_(True),
            User.is_on_duty.is_(True),
            User.deleted_at.is_(None),
        )
        if department_id:
            statement = statement.where(User.department_id == department_id)
        return self.db.execute(statement.order_by(User.updated_at)).scalars().first()


class FCMTokenRepository(BaseRepository[FCMToken]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, FCMToken)

    def upsert(
        self,
        hotel_id: str,
        user_id: str,
        token: str,
        platform: str,
    ) -> FCMToken:
        row = self.db.execute(
            select(FCMToken).where(
                FCMToken.user_id == user_id,
                FCMToken.token == token,
            )
        ).scalar_one_or_none()
        if row:
            row.hotel_id = hotel_id
            row.platform = platform
            row.updated_at = utcnow()
        else:
            row = FCMToken(
                hotel_id=hotel_id,
                user_id=user_id,
                token=token,
                platform=platform,
                updated_at=utcnow(),
            )
            self.db.add(row)

        self.db.commit()
        self.db.refresh(row)
        return row

    def list_for_user(self, user_id: str) -> Sequence[FCMToken]:
        return self.db.execute(
            select(FCMToken).where(FCMToken.user_id == user_id)
        ).scalars().all()

    def delete_for_user(self, user_id: str, token: str) -> int:
        result = self.db.execute(
            delete(FCMToken).where(
                FCMToken.user_id == user_id,
                FCMToken.token == token,
            )
        )
        self.db.commit()
        return result.rowcount or 0


class UserSessionRepository(BaseRepository[UserSession]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, UserSession)

    def active_for_user(self, user_id: str) -> Sequence[UserSession]:
        return self.db.execute(
            select(UserSession).where(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
            )
        ).scalars().all()

    def active_candidates(self, user_id: str, now: datetime) -> Sequence[UserSession]:
        return self.db.execute(
            select(UserSession).where(
                UserSession.user_id == user_id,
                UserSession.revoked_at.is_(None),
                UserSession.expires_at > now,
            )
        ).scalars().all()

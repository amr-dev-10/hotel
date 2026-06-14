from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, User)

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

from collections.abc import Sequence
from datetime import date, time

from sqlalchemy import false, select
from sqlalchemy.orm import Session

from app.models.staff import EmployeeShift
from app.models.user import User
from app.repositories.base import BaseRepository


class EmployeeShiftRepository(BaseRepository[EmployeeShift]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, EmployeeShift)

    def list_visible(
        self,
        hotel_id: str,
        visibility_scope: str,
        user_id: str | None = None,
        department_id: str | None = None,
        limit: int = 500,
    ) -> Sequence[EmployeeShift]:
        statement = select(EmployeeShift).where(EmployeeShift.hotel_id == hotel_id)
        if visibility_scope == "own":
            statement = statement.where(EmployeeShift.user_id == user_id) if user_id else statement.where(false())
        elif visibility_scope == "department":
            statement = (
                statement.where(EmployeeShift.department_id == department_id)
                if department_id
                else statement.where(false())
            )
        elif visibility_scope != "all":
            statement = statement.where(false())
        return self.db.execute(
            statement.order_by(EmployeeShift.shift_date.desc(), EmployeeShift.shift_start).limit(limit)
        ).scalars().all()

    def active_staff(
        self,
        hotel_id: str,
        department_id: str | None,
        shift_date: date,
        current_time: time,
    ) -> Sequence[User]:
        statement = (
            select(User)
            .join(EmployeeShift, EmployeeShift.user_id == User.id)
            .where(
                EmployeeShift.hotel_id == hotel_id,
                EmployeeShift.shift_date == shift_date,
                EmployeeShift.shift_start <= current_time,
                EmployeeShift.shift_end >= current_time,
                EmployeeShift.status == "checked_in",
                User.is_active.is_(True),
                User.deleted_at.is_(None),
            )
        )
        if department_id:
            statement = statement.where(EmployeeShift.department_id == department_id)
        return self.db.execute(statement).scalars().all()

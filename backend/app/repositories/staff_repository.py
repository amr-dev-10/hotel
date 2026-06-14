from collections.abc import Sequence
from datetime import date, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.staff import EmployeeShift
from app.models.user import User
from app.repositories.base import BaseRepository


class EmployeeShiftRepository(BaseRepository[EmployeeShift]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, EmployeeShift)

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

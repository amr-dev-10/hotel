from collections.abc import Sequence
from datetime import date

from sqlalchemy import false, or_, select
from sqlalchemy.orm import Session

from app.models.staff import AttendanceLog, EmployeeShiftAssignment, HotelHoliday, ShiftTemplate
from app.models.user import User
from app.repositories.base import BaseRepository


class ShiftTemplateRepository(BaseRepository[ShiftTemplate]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ShiftTemplate)

    def list_for_hotel(self, hotel_id: str, active_only: bool = False) -> Sequence[ShiftTemplate]:
        statement = select(ShiftTemplate).where(ShiftTemplate.hotel_id == hotel_id)
        if active_only:
            statement = statement.where(ShiftTemplate.is_active.is_(True))
        return self.db.execute(statement.order_by(ShiftTemplate.name)).scalars().all()

    def get_by_code(self, hotel_id: str, code: str) -> ShiftTemplate | None:
        return self.db.execute(
            select(ShiftTemplate).where(
                ShiftTemplate.hotel_id == hotel_id,
                ShiftTemplate.code == code,
            )
        ).scalar_one_or_none()

    def get_default(self, hotel_id: str) -> ShiftTemplate | None:
        return self.db.execute(
            select(ShiftTemplate).where(
                ShiftTemplate.hotel_id == hotel_id,
                ShiftTemplate.is_default.is_(True),
            )
        ).scalars().first()


class ShiftAssignmentRepository(BaseRepository[EmployeeShiftAssignment]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, EmployeeShiftAssignment)

    def list_for_hotel(
        self,
        hotel_id: str,
        active_only: bool = False,
        employee_id: str | None = None,
    ) -> Sequence[EmployeeShiftAssignment]:
        statement = select(EmployeeShiftAssignment).where(EmployeeShiftAssignment.hotel_id == hotel_id)
        if active_only:
            statement = statement.where(EmployeeShiftAssignment.is_active.is_(True))
        if employee_id:
            statement = statement.where(EmployeeShiftAssignment.employee_id == employee_id)
        return self.db.execute(
            statement.order_by(
                EmployeeShiftAssignment.effective_from.desc(),
                EmployeeShiftAssignment.created_at.desc(),
            )
        ).scalars().all()

    def list_active_for_date(
        self,
        hotel_id: str,
        target_date: date,
    ) -> Sequence[EmployeeShiftAssignment]:
        return self.db.execute(
            select(EmployeeShiftAssignment)
            .where(
                EmployeeShiftAssignment.hotel_id == hotel_id,
                EmployeeShiftAssignment.is_active.is_(True),
                EmployeeShiftAssignment.effective_from <= target_date,
                or_(
                    EmployeeShiftAssignment.effective_to.is_(None),
                    EmployeeShiftAssignment.effective_to >= target_date,
                ),
            )
            .order_by(
                EmployeeShiftAssignment.employee_id,
                EmployeeShiftAssignment.effective_from.desc(),
                EmployeeShiftAssignment.created_at.desc(),
            )
        ).scalars().all()

    def active_for_employee_on_date(
        self,
        hotel_id: str,
        employee_id: str,
        target_date: date,
    ) -> EmployeeShiftAssignment | None:
        assignments = self.list_active_for_date(hotel_id, target_date)
        for assignment in assignments:
            if assignment.employee_id == employee_id:
                return assignment
        return None


class AttendanceLogRepository(BaseRepository[AttendanceLog]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, AttendanceLog)

    def get_for_employee_date(
        self,
        hotel_id: str,
        employee_id: str,
        attendance_date: date,
    ) -> AttendanceLog | None:
        return self.db.execute(
            select(AttendanceLog).where(
                AttendanceLog.hotel_id == hotel_id,
                AttendanceLog.employee_id == employee_id,
                AttendanceLog.attendance_date == attendance_date,
            )
        ).scalar_one_or_none()

    def list_visible(
        self,
        hotel_id: str,
        visibility_scope: str,
        *,
        user_id: str | None = None,
        department_id: str | None = None,
        employee_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        limit: int = 500,
    ) -> Sequence[AttendanceLog]:
        statement = select(AttendanceLog).where(AttendanceLog.hotel_id == hotel_id)
        if visibility_scope == "own":
            statement = statement.where(AttendanceLog.employee_id == user_id) if user_id else statement.where(false())
        elif visibility_scope == "department":
            if department_id:
                statement = statement.join(User, User.id == AttendanceLog.employee_id).where(User.department_id == department_id)
            else:
                statement = statement.where(false())
        elif visibility_scope != "all":
            statement = statement.where(false())

        if employee_id:
            statement = statement.where(AttendanceLog.employee_id == employee_id)
        if start_date:
            statement = statement.where(AttendanceLog.attendance_date >= start_date)
        if end_date:
            statement = statement.where(AttendanceLog.attendance_date <= end_date)

        return self.db.execute(
            statement.order_by(AttendanceLog.attendance_date.desc(), AttendanceLog.created_at.desc()).limit(limit)
        ).scalars().all()


class HotelHolidayRepository(BaseRepository[HotelHoliday]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, HotelHoliday)

    def get_by_date(self, hotel_id: str, holiday_date: date) -> HotelHoliday | None:
        return self.db.execute(
            select(HotelHoliday).where(
                HotelHoliday.hotel_id == hotel_id,
                HotelHoliday.date == holiday_date,
            )
        ).scalar_one_or_none()

    def list_for_hotel(
        self,
        hotel_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Sequence[HotelHoliday]:
        statement = select(HotelHoliday).where(HotelHoliday.hotel_id == hotel_id)
        if start_date:
            statement = statement.where(HotelHoliday.date >= start_date)
        if end_date:
            statement = statement.where(HotelHoliday.date <= end_date)
        return self.db.execute(statement.order_by(HotelHoliday.date)).scalars().all()

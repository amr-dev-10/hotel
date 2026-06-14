from datetime import date, time

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.staff import EmployeeShift
from app.models.user import User
from app.repositories.department_repository import DepartmentRepository
from app.repositories.staff_repository import EmployeeShiftRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.schemas.staff import ShiftBulkCreate, ShiftCreate, ShiftUpdate
from app.services.audit_service import AuditService


class ShiftService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.shifts = EmployeeShiftRepository(db)
        self.users = UserRepository(db)
        self.departments = DepartmentRepository(db)
        self.tickets = TicketRepository(db)

    def create(self, hotel_id: str, payload: ShiftCreate, actor_id: str | None) -> EmployeeShift:
        if not self.users.get_for_hotel(hotel_id, payload.user_id):
            raise not_found("User not found")
        if payload.department_id and not self.departments.get_for_hotel(hotel_id, payload.department_id):
            raise not_found("Department not found")
        shift = EmployeeShift(hotel_id=hotel_id, created_by=actor_id, **payload.model_dump())
        self.db.add(shift)
        AuditService(self.db).log(hotel_id, "shift.created", "employee_shift", None, actor_id)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def bulk_create(self, hotel_id: str, payload: ShiftBulkCreate, actor_id: str | None) -> list[EmployeeShift]:
        created: list[EmployeeShift] = []
        for item in payload.shifts:
            department_id = item.department_id
            if not department_id and item.department:
                department = self.departments.get_by_key(hotel_id, item.department)
                department_id = department.id if department else None
            for shift_date in item.dates:
                created.append(
                    self.create(
                        hotel_id,
                        ShiftCreate(
                            user_id=item.user_id,
                            department_id=department_id,
                            shift_date=shift_date,
                            shift_start=item.shift_start,
                            shift_end=item.shift_end,
                            shift_type=item.type,
                        ),
                        actor_id,
                    )
                )
        return created

    def update(self, hotel_id: str, shift_id: str, payload: ShiftUpdate, actor_id: str | None) -> EmployeeShift:
        shift = self.shifts.get_for_hotel(hotel_id, shift_id)
        if not shift:
            raise not_found("Shift not found")
        data = payload.model_dump(exclude_unset=True)
        for key, value in data.items():
            setattr(shift, key, value)
        if shift.status == "checked_in" and not shift.actual_start:
            shift.actual_start = utcnow()
        if shift.status == "checked_out" and not shift.actual_end:
            shift.actual_end = utcnow()
        AuditService(self.db).log(hotel_id, "shift.updated", "employee_shift", shift.id, actor_id)
        self.db.commit()
        self.db.refresh(shift)
        return shift

    def find_available_staff(
        self,
        hotel_id: str,
        department_id: str | None,
        shift_date: date,
        current_time: time,
    ) -> User | None:
        staff = list(self.shifts.active_staff(hotel_id, department_id, shift_date, current_time))
        if not staff:
            return None
        staff.sort(key=lambda user: self.tickets.count_open_for_user(hotel_id, user.id))
        return staff[0]

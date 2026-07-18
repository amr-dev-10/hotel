from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, conflict, not_found
from app.models.base import utcnow
from app.models.staff import AttendanceLog, EmployeeShiftAssignment, HotelHoliday, ShiftTemplate
from app.models.user import User
from app.repositories.attendance_repository import (
    AttendanceLogRepository,
    HotelHolidayRepository,
    ShiftAssignmentRepository,
    ShiftTemplateRepository,
)
from app.repositories.user_repository import UserRepository
from app.schemas.attendance import (
    AttendanceActionPayload,
    BulkDefaultShiftAssignmentCreate,
    HotelHolidayCreate,
    ShiftAssignmentCreate,
    ShiftAssignmentUpdate,
    ShiftTemplateCreate,
    ShiftTemplateUpdate,
)
from app.services.audit_service import AuditService

STATUS_SCHEDULED = "SCHEDULED"
STATUS_CHECKED_IN = "CHECKED_IN"
STATUS_COMPLETED = "COMPLETED"
STATUS_ABSENT = "ABSENT"
STATUS_HOLIDAY = "HOLIDAY"
STATUS_WEEKEND = "WEEKEND"

ARRIVAL_UNKNOWN = "UNKNOWN"
ARRIVAL_ON_TIME = "ON_TIME"
ARRIVAL_LATE = "LATE"

DEFAULT_SHIFT_TEMPLATE = {
    "name": "Morning Shift",
    "code": "MORNING",
    "start_time": time(9, 0),
    "end_time": time(17, 0),
    "break_minutes": 30,
    "grace_minutes": 10,
    "late_after_minutes": 10,
    "is_night_shift": False,
    "is_default": True,
    "is_active": True,
}


class AttendanceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.templates = ShiftTemplateRepository(db)
        self.assignments = ShiftAssignmentRepository(db)
        self.logs = AttendanceLogRepository(db)
        self.holidays = HotelHolidayRepository(db)
        self.users = UserRepository(db)

    def list_templates(self, hotel_id: str) -> Sequence[ShiftTemplate]:
        return self.templates.list_for_hotel(hotel_id)

    def create_template(self, hotel_id: str, payload: ShiftTemplateCreate, actor_id: str | None) -> ShiftTemplate:
        if self.templates.get_by_code(hotel_id, payload.code):
            raise conflict("Shift template code already exists for this hotel")
        if payload.is_default:
            self._clear_default_templates(hotel_id)
        template = ShiftTemplate(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(template)
        AuditService(self.db).log(hotel_id, "attendance.shift_template.created", "shift_template", None, actor_id)
        self.db.commit()
        self.db.refresh(template)
        return template

    def update_template(
        self,
        hotel_id: str,
        template_id: str,
        payload: ShiftTemplateUpdate,
        actor_id: str | None,
    ) -> ShiftTemplate:
        template = self.templates.get_for_hotel(hotel_id, template_id)
        if not template:
            raise not_found("Shift template not found")
        data = payload.model_dump(exclude_unset=True)
        if "code" in data and data["code"] != template.code and self.templates.get_by_code(hotel_id, data["code"]):
            raise conflict("Shift template code already exists for this hotel")
        if data.get("is_default"):
            self._clear_default_templates(hotel_id, keep_id=template.id)
        for key, value in data.items():
            setattr(template, key, value)
        AuditService(self.db).log(hotel_id, "attendance.shift_template.updated", "shift_template", template.id, actor_id)
        self.db.commit()
        self.db.refresh(template)
        return template

    def list_assignments(self, hotel_id: str) -> Sequence[EmployeeShiftAssignment]:
        return self.assignments.list_for_hotel(hotel_id)

    def create_assignment(
        self,
        hotel_id: str,
        payload: ShiftAssignmentCreate,
        actor_id: str | None,
    ) -> EmployeeShiftAssignment:
        user = self._get_active_employee(hotel_id, payload.employee_id)
        template = self.templates.get_for_hotel(hotel_id, payload.shift_template_id)
        if not template:
            raise not_found("Shift template not found")
        if payload.effective_to and payload.effective_to < payload.effective_from:
            raise bad_request("Assignment end date cannot be before start date")
        data = payload.model_dump()
        data["employee_id"] = user.id
        assignment = EmployeeShiftAssignment(
            hotel_id=hotel_id,
            created_by=actor_id,
            **data,
        )
        self.db.add(assignment)
        AuditService(self.db).log(hotel_id, "attendance.shift_assignment.created", "shift_assignment", None, actor_id)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def bulk_assign_default(
        self,
        hotel_id: str,
        payload: BulkDefaultShiftAssignmentCreate,
        actor_id: str | None,
    ) -> dict:
        effective_from = payload.effective_from or utcnow().date()
        if payload.effective_to and payload.effective_to < effective_from:
            raise bad_request("Assignment end date cannot be before start date")

        template = self._template_for_bulk_default(hotel_id, payload.shift_template_id)
        self.db.flush()

        employees = [
            user
            for user in self.users.list_active_for_hotel(hotel_id)
            if self._is_bulk_assignment_employee(user, payload.include_admins)
        ]
        created = 0
        skipped = 0
        updated = 0

        for user in employees:
            existing = self.assignments.active_for_employee_on_date(hotel_id, user.id, effective_from)
            if existing and not payload.overwrite_existing:
                skipped += 1
                continue
            if existing and payload.overwrite_existing:
                for assignment in self.assignments.list_for_hotel(hotel_id, active_only=True, employee_id=user.id):
                    if self._assignment_overlaps(assignment, effective_from, payload.effective_to):
                        assignment.is_active = False
                        assignment.updated_at = utcnow()
                        updated += 1

            self.db.add(
                EmployeeShiftAssignment(
                    hotel_id=hotel_id,
                    employee_id=user.id,
                    shift_template_id=template.id,
                    effective_from=effective_from,
                    effective_to=payload.effective_to,
                    working_days=payload.working_days,
                    rotation_type=payload.rotation_type,
                    is_active=True,
                    created_by=actor_id,
                )
            )
            created += 1

        AuditService(self.db).log(
            hotel_id,
            "attendance.shift_assignment.bulk_default",
            "shift_assignment",
            None,
            actor_id,
            {
                "shift_template_id": template.id,
                "effective_from": effective_from.isoformat(),
                "created": created,
                "skipped": skipped,
                "updated": updated,
                "employee_count": len(employees),
            },
        )
        self.db.commit()
        self.db.refresh(template)
        return {
            "shift_template_id": template.id,
            "shift_template_name": template.name,
            "shift_template_code": template.code,
            "effective_from": effective_from,
            "created": created,
            "skipped": skipped,
            "updated": updated,
            "employee_count": len(employees),
        }

    def update_assignment(
        self,
        hotel_id: str,
        assignment_id: str,
        payload: ShiftAssignmentUpdate,
        actor_id: str | None,
    ) -> EmployeeShiftAssignment:
        assignment = self.assignments.get_for_hotel(hotel_id, assignment_id)
        if not assignment:
            raise not_found("Shift assignment not found")
        data = payload.model_dump(exclude_unset=True)
        if "shift_template_id" in data and not self.templates.get_for_hotel(hotel_id, data["shift_template_id"]):
            raise not_found("Shift template not found")
        effective_from = data.get("effective_from", assignment.effective_from)
        effective_to = data.get("effective_to", assignment.effective_to)
        if effective_to and effective_to < effective_from:
            raise bad_request("Assignment end date cannot be before start date")
        for key, value in data.items():
            setattr(assignment, key, value)
        AuditService(self.db).log(hotel_id, "attendance.shift_assignment.updated", "shift_assignment", assignment.id, actor_id)
        self.db.commit()
        self.db.refresh(assignment)
        return assignment

    def list_holidays(
        self,
        hotel_id: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Sequence[HotelHoliday]:
        return self.holidays.list_for_hotel(hotel_id, start_date, end_date)

    def create_holiday(self, hotel_id: str, payload: HotelHolidayCreate, actor_id: str | None) -> HotelHoliday:
        if self.holidays.get_by_date(hotel_id, payload.date):
            raise conflict("Holiday already exists for this date")
        holiday = HotelHoliday(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(holiday)
        AuditService(self.db).log(hotel_id, "attendance.holiday.created", "hotel_holiday", None, actor_id)
        self.db.commit()
        self.db.refresh(holiday)
        return holiday

    def today_for_user(self, hotel_id: str, user: User, target_date: date | None = None) -> dict:
        attendance_date = target_date or utcnow().date()
        assignment = self.assignments.active_for_employee_on_date(hotel_id, user.id, attendance_date)
        template = self.templates.get_for_hotel(hotel_id, assignment.shift_template_id) if assignment else None
        log = self.logs.get_for_employee_date(hotel_id, user.id, attendance_date)
        holiday = self.holidays.get_by_date(hotel_id, attendance_date)
        is_working_day = self._is_assignment_working_day(assignment, attendance_date)

        can_check_in = bool(assignment and template and is_working_day and not holiday and not log)
        if log and not log.actual_start and log.attendance_status == STATUS_SCHEDULED:
            can_check_in = True
        can_check_out = bool(log and log.actual_start and not log.actual_end and log.attendance_status == STATUS_CHECKED_IN)

        if holiday:
            message = f"Holiday: {holiday.title}"
        elif not assignment:
            message = "No active shift assignment for today."
        elif not is_working_day:
            message = "Today is not part of your assigned working days."
        elif log and log.actual_end:
            message = "Attendance completed for today."
        elif log and log.actual_start:
            message = "You are checked in."
        else:
            message = "Ready for check-in."

        return {
            "attendance_date": attendance_date,
            "assignment": assignment,
            "template": template,
            "log": log,
            "can_check_in": can_check_in,
            "can_check_out": can_check_out,
            "message": message,
        }

    def check_in(
        self,
        hotel_id: str,
        user: User,
        payload: AttendanceActionPayload,
        ip_address: str | None = None,
    ) -> AttendanceLog:
        attendance_date = utcnow().date()
        assignment = self.assignments.active_for_employee_on_date(hotel_id, user.id, attendance_date)
        if not assignment:
            raise bad_request("No active shift assignment for today")
        if not self._is_assignment_working_day(assignment, attendance_date):
            raise bad_request("Today is not a working day for this assignment")
        if self.holidays.get_by_date(hotel_id, attendance_date):
            raise bad_request("Today is marked as a holiday")

        template = self.templates.get_for_hotel(hotel_id, assignment.shift_template_id)
        if not template or not template.is_active:
            raise bad_request("Assigned shift template is inactive or missing")

        log = self.logs.get_for_employee_date(hotel_id, user.id, attendance_date)
        if log and log.actual_start:
            raise bad_request("Already checked in for today")
        if log and log.attendance_status not in {STATUS_SCHEDULED, STATUS_ABSENT}:
            raise bad_request("Attendance record cannot be checked in")
        if not log:
            log = self._new_scheduled_log(hotel_id, user.id, attendance_date, assignment, template)
            self.db.add(log)

        now = utcnow()
        log.actual_start = now
        log.attendance_status = STATUS_CHECKED_IN
        log.arrival_status = self._arrival_status(now, template, log.scheduled_start)
        log.late_minutes = self._late_minutes(now, template, log.scheduled_start)
        log.checkin_method = payload.method
        log.device_info = payload.device_info
        log.gps_location = payload.gps_location
        log.ip_address = ip_address
        log.notes = payload.notes or log.notes
        log.updated_at = now
        user.is_on_duty = True
        self.db.commit()
        self.db.refresh(log)
        return log

    def check_out(
        self,
        hotel_id: str,
        user: User,
        payload: AttendanceActionPayload,
        ip_address: str | None = None,
    ) -> AttendanceLog:
        attendance_date = utcnow().date()
        log = self.logs.get_for_employee_date(hotel_id, user.id, attendance_date)
        if not log or not log.actual_start:
            raise bad_request("Check-in is required before check-out")
        if log.actual_end:
            raise bad_request("Already checked out for today")

        now = utcnow()
        log.actual_end = now
        log.attendance_status = STATUS_COMPLETED
        log.checkout_method = payload.method
        log.ip_address = ip_address or log.ip_address
        log.device_info = payload.device_info or log.device_info
        log.gps_location = payload.gps_location or log.gps_location
        log.notes = payload.notes or log.notes
        self._calculate_worked_minutes(log)
        log.updated_at = now
        user.is_on_duty = False
        self.db.commit()
        self.db.refresh(log)
        return log

    def list_logs(
        self,
        hotel_id: str,
        visibility_scope: str,
        *,
        user_id: str | None,
        department_id: str | None,
        employee_id: str | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Sequence[AttendanceLog]:
        return self.logs.list_visible(
            hotel_id,
            visibility_scope,
            user_id=user_id,
            department_id=department_id,
            employee_id=employee_id,
            start_date=start_date,
            end_date=end_date,
        )

    def dashboard(
        self,
        hotel_id: str,
        visibility_scope: str,
        *,
        user_id: str | None,
        department_id: str | None,
        attendance_date: date,
    ) -> dict:
        logs = list(
            self.list_logs(
                hotel_id,
                visibility_scope,
                user_id=user_id,
                department_id=department_id,
                start_date=attendance_date,
                end_date=attendance_date,
            )
        )
        present_ids = {
            log.employee_id
            for log in logs
            if log.actual_start or log.attendance_status in {STATUS_CHECKED_IN, STATUS_COMPLETED}
        }
        return {
            "attendance_date": attendance_date,
            "total_records": len(logs),
            "present": len(present_ids),
            "scheduled": self._count_status(logs, STATUS_SCHEDULED),
            "checked_in": self._count_status(logs, STATUS_CHECKED_IN),
            "checked_out": self._count_status(logs, STATUS_COMPLETED),
            "absent": self._count_status(logs, STATUS_ABSENT),
            "late": len([log for log in logs if log.arrival_status == ARRIVAL_LATE]),
            "on_leave": len([log for log in logs if log.leave_status != "NONE"]),
            "holidays": self._count_status(logs, STATUS_HOLIDAY),
            "weekends": self._count_status(logs, STATUS_WEEKEND),
            "logs": logs,
        }

    def finalize_missing_for_date(self, hotel_id: str, attendance_date: date, actor_id: str | None) -> dict:
        assignments = self.assignments.list_active_for_date(hotel_id, attendance_date)
        template_by_id = {template.id: template for template in self.templates.list_for_hotel(hotel_id, active_only=True)}
        holiday = self.holidays.get_by_date(hotel_id, attendance_date)
        seen_employee_ids: set[str] = set()
        created = 0
        skipped = 0

        for assignment in assignments:
            if assignment.employee_id in seen_employee_ids:
                skipped += 1
                continue
            seen_employee_ids.add(assignment.employee_id)

            if self.logs.get_for_employee_date(hotel_id, assignment.employee_id, attendance_date):
                skipped += 1
                continue
            template = template_by_id.get(assignment.shift_template_id)
            if not template:
                skipped += 1
                continue
            log = self._new_scheduled_log(hotel_id, assignment.employee_id, attendance_date, assignment, template)
            if holiday:
                log.attendance_status = STATUS_HOLIDAY
                log.notes = holiday.title
            elif not self._is_assignment_working_day(assignment, attendance_date):
                log.attendance_status = STATUS_WEEKEND
            else:
                log.attendance_status = STATUS_ABSENT
            self.db.add(log)
            created += 1

        AuditService(self.db).log(
            hotel_id,
            "attendance.finalized",
            "attendance_log",
            None,
            actor_id,
            {"attendance_date": attendance_date.isoformat(), "created": created, "skipped": skipped},
        )
        self.db.commit()
        return {"attendance_date": attendance_date, "created": created, "skipped": skipped}

    def _get_active_employee(self, hotel_id: str, user_id: str) -> User:
        user = self.users.get_for_hotel(hotel_id, user_id)
        if not user or not user.is_active:
            raise not_found("Employee not found")
        return user

    def _template_for_bulk_default(self, hotel_id: str, template_id: str | None) -> ShiftTemplate:
        if template_id:
            template = self.templates.get_for_hotel(hotel_id, template_id)
            if not template:
                raise not_found("Shift template not found")
            if not template.is_active:
                raise bad_request("Shift template is inactive")
            if not template.is_default:
                self._clear_default_templates(hotel_id, keep_id=template.id)
                template.is_default = True
            return template

        template = self.templates.get_default(hotel_id)
        if template:
            if not template.is_active:
                template.is_active = True
            return template

        template = self.templates.get_by_code(hotel_id, DEFAULT_SHIFT_TEMPLATE["code"])
        if template:
            self._clear_default_templates(hotel_id, keep_id=template.id)
            template.is_default = True
            template.is_active = True
            return template

        template = ShiftTemplate(hotel_id=hotel_id, **DEFAULT_SHIFT_TEMPLATE)
        self.db.add(template)
        return template

    def _clear_default_templates(self, hotel_id: str, keep_id: str | None = None) -> None:
        for template in self.templates.list_for_hotel(hotel_id):
            if template.id != keep_id and template.is_default:
                template.is_default = False

    @staticmethod
    def _is_bulk_assignment_employee(user: User, include_admins: bool) -> bool:
        if user.is_hotel_owner:
            return False
        return include_admins or user.user_type == "HOTEL_EMPLOYEE"

    @staticmethod
    def _assignment_overlaps(
        assignment: EmployeeShiftAssignment,
        effective_from: date,
        effective_to: date | None,
    ) -> bool:
        assignment_to = assignment.effective_to or date.max
        new_to = effective_to or date.max
        return assignment.effective_from <= new_to and assignment_to >= effective_from

    @staticmethod
    def _is_assignment_working_day(assignment: EmployeeShiftAssignment | None, target_date: date) -> bool:
        if not assignment:
            return False
        working_days = assignment.working_days or []
        return target_date.weekday() in working_days

    @staticmethod
    def _scheduled_window(attendance_date: date, template: ShiftTemplate) -> tuple[datetime, datetime]:
        start = datetime.combine(attendance_date, template.start_time).replace(tzinfo=UTC)
        end_date = attendance_date + timedelta(days=1) if template.is_night_shift or template.end_time <= template.start_time else attendance_date
        end = datetime.combine(end_date, template.end_time).replace(tzinfo=UTC)
        return start, end

    def _new_scheduled_log(
        self,
        hotel_id: str,
        employee_id: str,
        attendance_date: date,
        assignment: EmployeeShiftAssignment,
        template: ShiftTemplate,
    ) -> AttendanceLog:
        scheduled_start, scheduled_end = self._scheduled_window(attendance_date, template)
        return AttendanceLog(
            hotel_id=hotel_id,
            employee_id=employee_id,
            attendance_date=attendance_date,
            shift_assignment_id=assignment.id,
            shift_template_id=template.id,
            shift_name=template.name,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            attendance_status=STATUS_SCHEDULED,
            arrival_status=ARRIVAL_UNKNOWN,
            leave_status="NONE",
            worked_minutes=0,
            late_minutes=0,
            early_leave_minutes=0,
            overtime_minutes=0,
        )

    @staticmethod
    def _arrival_status(now: datetime, template: ShiftTemplate, scheduled_start: datetime | None) -> str:
        if not scheduled_start:
            return ARRIVAL_UNKNOWN
        scheduled_start = AttendanceService._as_utc(scheduled_start)
        threshold_minutes = max(template.grace_minutes or 0, template.late_after_minutes or 0)
        return ARRIVAL_LATE if now > scheduled_start + timedelta(minutes=threshold_minutes) else ARRIVAL_ON_TIME

    @staticmethod
    def _late_minutes(now: datetime, template: ShiftTemplate, scheduled_start: datetime | None) -> int:
        if not scheduled_start:
            return 0
        scheduled_start = AttendanceService._as_utc(scheduled_start)
        threshold_minutes = max(template.grace_minutes or 0, template.late_after_minutes or 0)
        if now <= scheduled_start + timedelta(minutes=threshold_minutes):
            return 0
        return max(0, int((now - scheduled_start).total_seconds() // 60))

    @staticmethod
    def _calculate_worked_minutes(log: AttendanceLog) -> None:
        if not log.actual_start or not log.actual_end:
            return
        actual_start = AttendanceService._as_utc(log.actual_start)
        actual_end = AttendanceService._as_utc(log.actual_end)
        log.worked_minutes = max(0, int((actual_end - actual_start).total_seconds() // 60))
        if log.scheduled_end:
            scheduled_end = AttendanceService._as_utc(log.scheduled_end)
            log.early_leave_minutes = max(0, int((scheduled_end - actual_end).total_seconds() // 60))
            log.overtime_minutes = max(0, int((actual_end - scheduled_end).total_seconds() // 60))

    @staticmethod
    def _as_utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)

    @staticmethod
    def _count_status(logs: Sequence[AttendanceLog], status: str) -> int:
        return len([log for log in logs if log.attendance_status == status])

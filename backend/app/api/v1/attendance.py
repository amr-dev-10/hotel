from datetime import date
from collections.abc import Sequence

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user, require_any_permission, require_permission
from app.core.database import get_db, set_tenant_context
from app.core.permissions import Permissions
from app.core.responses import ok
from app.models.base import utcnow
from app.models.staff import AttendanceLog, EmployeeShiftAssignment, ShiftTemplate
from app.models.user import User
from app.repositories.attendance_repository import ShiftTemplateRepository
from app.repositories.user_repository import UserRepository
from app.schemas.attendance import (
    AttendanceActionPayload,
    AttendanceDashboardRead,
    AttendanceFinalizePayload,
    AttendanceFinalizeRead,
    AttendanceLogRead,
    AttendanceTodayRead,
    BulkDefaultShiftAssignmentCreate,
    BulkDefaultShiftAssignmentRead,
    HotelHolidayCreate,
    HotelHolidayRead,
    ShiftAssignmentCreate,
    ShiftAssignmentRead,
    ShiftAssignmentUpdate,
    ShiftTemplateCreate,
    ShiftTemplateRead,
    ShiftTemplateUpdate,
)
from app.services.attendance_service import AttendanceService
from app.services.rbac_service import RBACService

router = APIRouter()

SHIFT_READ_PERMISSIONS = (
    Permissions.SHIFT_MANAGE,
    Permissions.SHIFT_VIEW,
    Permissions.SHIFT_VIEW_DEPT,
    Permissions.SHIFT_VIEW_OWN,
    Permissions.SHIFT_UPDATE,
    Permissions.SHIFT_UPDATE_OWN,
)


@router.get("/templates")
def list_templates(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*SHIFT_READ_PERMISSIONS)),
) -> dict:
    templates = AttendanceService(db).list_templates(hotel_id)
    return ok([ShiftTemplateRead.model_validate(item).model_dump() for item in templates])


@router.post("/templates")
def create_template(
    hotel_id: str,
    payload: ShiftTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    template = AttendanceService(db).create_template(hotel_id, payload, current_user.id)
    return ok(ShiftTemplateRead.model_validate(template).model_dump())


@router.patch("/templates/{template_id}")
def update_template(
    hotel_id: str,
    template_id: str,
    payload: ShiftTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    template = AttendanceService(db).update_template(hotel_id, template_id, payload, current_user.id)
    return ok(ShiftTemplateRead.model_validate(template).model_dump())


@router.get("/assignments")
def list_assignments(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*SHIFT_READ_PERMISSIONS)),
) -> dict:
    scope = RBACService(db).shift_visibility_scope(current_user)
    assignments = AttendanceService(db).list_assignments(hotel_id)
    if scope == "own":
        assignments = [assignment for assignment in assignments if assignment.employee_id == current_user.id]
    elif scope == "department":
        staff = _staff_by_id(db, hotel_id)
        assignments = [
            assignment
            for assignment in assignments
            if staff.get(assignment.employee_id) and staff[assignment.employee_id].department_id == current_user.department_id
        ]
    elif scope != "all":
        assignments = []
    return ok(_assignment_reads(db, hotel_id, assignments))


@router.post("/assignments")
def create_assignment(
    hotel_id: str,
    payload: ShiftAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    assignment = AttendanceService(db).create_assignment(hotel_id, payload, current_user.id)
    return ok(_assignment_read(db, hotel_id, assignment))


@router.post("/assignments/bulk-default")
def bulk_assign_default(
    hotel_id: str,
    payload: BulkDefaultShiftAssignmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    result = AttendanceService(db).bulk_assign_default(hotel_id, payload, current_user.id)
    return ok(BulkDefaultShiftAssignmentRead.model_validate(result).model_dump())


@router.patch("/assignments/{assignment_id}")
def update_assignment(
    hotel_id: str,
    assignment_id: str,
    payload: ShiftAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    assignment = AttendanceService(db).update_assignment(hotel_id, assignment_id, payload, current_user.id)
    return ok(_assignment_read(db, hotel_id, assignment))


@router.get("/holidays")
def list_holidays(
    hotel_id: str,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*SHIFT_READ_PERMISSIONS)),
) -> dict:
    holidays = AttendanceService(db).list_holidays(hotel_id, start_date, end_date)
    return ok([HotelHolidayRead.model_validate(item).model_dump() for item in holidays])


@router.post("/holidays")
def create_holiday(
    hotel_id: str,
    payload: HotelHolidayCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    holiday = AttendanceService(db).create_holiday(hotel_id, payload, current_user.id)
    return ok(HotelHolidayRead.model_validate(holiday).model_dump())


@router.get("/today")
def attendance_today(
    hotel_id: str,
    attendance_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_self_access(hotel_id, current_user, db)
    data = AttendanceService(db).today_for_user(hotel_id, current_user, attendance_date)
    payload = {
        "attendance_date": data["attendance_date"],
        "assignment": _assignment_read(db, hotel_id, data["assignment"]) if data["assignment"] else None,
        "template": ShiftTemplateRead.model_validate(data["template"]).model_dump() if data["template"] else None,
        "log": _log_read(db, hotel_id, data["log"]) if data["log"] else None,
        "can_check_in": data["can_check_in"],
        "can_check_out": data["can_check_out"],
        "message": data["message"],
    }
    return ok(AttendanceTodayRead.model_validate(payload).model_dump())


@router.post("/check-in")
def check_in(
    hotel_id: str,
    request: Request,
    payload: AttendanceActionPayload | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_self_access(hotel_id, current_user, db)
    log = AttendanceService(db).check_in(
        hotel_id,
        current_user,
        payload or AttendanceActionPayload(),
        request.client.host if request.client else None,
    )
    return ok(_log_read(db, hotel_id, log))


@router.post("/check-out")
def check_out(
    hotel_id: str,
    request: Request,
    payload: AttendanceActionPayload | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    _ensure_self_access(hotel_id, current_user, db)
    log = AttendanceService(db).check_out(
        hotel_id,
        current_user,
        payload or AttendanceActionPayload(),
        request.client.host if request.client else None,
    )
    return ok(_log_read(db, hotel_id, log))


@router.get("/logs")
def list_logs(
    hotel_id: str,
    employee_id: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*SHIFT_READ_PERMISSIONS)),
) -> dict:
    scope = RBACService(db).shift_visibility_scope(current_user)
    logs = AttendanceService(db).list_logs(
        hotel_id,
        scope,
        user_id=current_user.id,
        department_id=current_user.department_id,
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
    )
    return ok(_log_reads(db, hotel_id, logs))


@router.get("/dashboard")
def dashboard(
    hotel_id: str,
    attendance_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(*SHIFT_READ_PERMISSIONS)),
) -> dict:
    target_date = attendance_date or utcnow().date()
    scope = RBACService(db).shift_visibility_scope(current_user)
    data = AttendanceService(db).dashboard(
        hotel_id,
        scope,
        user_id=current_user.id,
        department_id=current_user.department_id,
        attendance_date=target_date,
    )
    payload = {
        **data,
        "logs": _log_reads(db, hotel_id, data["logs"]),
    }
    return ok(AttendanceDashboardRead.model_validate(payload).model_dump())


@router.post("/finalize-missing")
def finalize_missing(
    hotel_id: str,
    payload: AttendanceFinalizePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.SHIFT_MANAGE)),
) -> dict:
    result = AttendanceService(db).finalize_missing_for_date(hotel_id, payload.attendance_date, current_user.id)
    return ok(AttendanceFinalizeRead.model_validate(result).model_dump())


def _ensure_self_access(hotel_id: str, current_user: User, db: Session) -> None:
    ensure_hotel_access(hotel_id, current_user)
    set_tenant_context(db, hotel_id)


def _staff_by_id(db: Session, hotel_id: str) -> dict[str, User]:
    return {user.id: user for user in UserRepository(db).list_for_hotel(hotel_id, limit=5000)}


def _template_by_id(db: Session, hotel_id: str) -> dict[str, ShiftTemplate]:
    return {template.id: template for template in ShiftTemplateRepository(db).list_for_hotel(hotel_id)}


def _assignment_reads(
    db: Session,
    hotel_id: str,
    assignments: Sequence[EmployeeShiftAssignment],
) -> list[dict]:
    staff = _staff_by_id(db, hotel_id)
    templates = _template_by_id(db, hotel_id)
    return [_assignment_read_from_context(item, staff, templates) for item in assignments]


def _assignment_read(
    db: Session,
    hotel_id: str,
    assignment: EmployeeShiftAssignment,
) -> dict:
    return _assignment_read_from_context(assignment, _staff_by_id(db, hotel_id), _template_by_id(db, hotel_id))


def _assignment_read_from_context(
    assignment: EmployeeShiftAssignment,
    staff: dict[str, User],
    templates: dict[str, ShiftTemplate],
) -> dict:
    employee = staff.get(assignment.employee_id)
    template = templates.get(assignment.shift_template_id)
    data = ShiftAssignmentRead.model_validate(assignment).model_dump()
    data["employee_name"] = employee.name if employee else None
    data["employee_code"] = employee.employee_code if employee else None
    data["template_name"] = getattr(template, "name", None)
    data["template_code"] = getattr(template, "code", None)
    return data


def _log_reads(db: Session, hotel_id: str, logs: Sequence[AttendanceLog]) -> list[dict]:
    staff = _staff_by_id(db, hotel_id)
    return [_log_read_from_context(log, staff) for log in logs]


def _log_read(db: Session, hotel_id: str, log: AttendanceLog) -> dict:
    return _log_read_from_context(log, _staff_by_id(db, hotel_id))


def _log_read_from_context(log: AttendanceLog, staff: dict[str, User]) -> dict:
    employee = staff.get(log.employee_id)
    data = AttendanceLogRead.model_validate(log).model_dump()
    data["employee_name"] = employee.name if employee else None
    data["employee_code"] = employee.employee_code if employee else None
    return data

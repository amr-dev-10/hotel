from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_any_permission, require_permission
from app.core.database import get_db
from app.core.exceptions import forbidden, not_found
from app.core.permissions import Permissions
from app.core.responses import ok
from app.models.user import User
from app.repositories.staff_repository import EmployeeShiftRepository
from app.schemas.staff import ShiftBulkCreate, ShiftCreate, ShiftRead, ShiftUpdate
from app.services.rbac_service import RBACService
from app.services.staff_service import ShiftService

router = APIRouter()


@router.get("")
def list_shifts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_any_permission(
            Permissions.SHIFT_MANAGE,
            Permissions.SHIFT_VIEW_DEPT,
            Permissions.SHIFT_VIEW_OWN,
            Permissions.SHIFT_UPDATE_OWN,
        )
    ),
) -> dict:
    visibility_scope = RBACService(db).shift_visibility_scope(current_user)
    shifts = EmployeeShiftRepository(db).list_visible(
        hotel_id,
        visibility_scope,
        user_id=current_user.id,
        department_id=current_user.department_id,
    )
    return ok([ShiftRead.model_validate(item).model_dump() for item in shifts])


@router.post("")
def create_shift(
    hotel_id: str,
    payload: ShiftCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shift.manage")),
) -> dict:
    shift = ShiftService(db).create(hotel_id, payload, current_user.id)
    return ok(ShiftRead.model_validate(shift).model_dump())


@router.post("/bulk")
def bulk_create_shifts(
    hotel_id: str,
    payload: ShiftBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shift.manage")),
) -> dict:
    shifts = ShiftService(db).bulk_create(hotel_id, payload, current_user.id)
    return ok([ShiftRead.model_validate(item).model_dump() for item in shifts])


@router.patch("/{shift_id}")
def update_shift(
    hotel_id: str,
    shift_id: str,
    payload: ShiftUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission(Permissions.SHIFT_MANAGE, Permissions.SHIFT_UPDATE_OWN)),
) -> dict:
    rbac = RBACService(db)
    if not rbac.has_any(current_user, [Permissions.SHIFT_MANAGE]):
        shift = EmployeeShiftRepository(db).get_for_hotel(hotel_id, shift_id)
        if not shift:
            raise not_found("Shift not found")
        if shift.user_id != current_user.id:
            raise forbidden("Shift is outside your access scope")
    shift = ShiftService(db).update(hotel_id, shift_id, payload, current_user.id)
    return ok(ShiftRead.model_validate(shift).model_dump())

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.staff_repository import EmployeeShiftRepository
from app.schemas.staff import ShiftBulkCreate, ShiftCreate, ShiftRead, ShiftUpdate
from app.services.staff_service import ShiftService

router = APIRouter()


@router.get("")
def list_shifts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("shift.manage")),
) -> dict:
    shifts = EmployeeShiftRepository(db).list_for_hotel(hotel_id)
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
    current_user: User = Depends(require_permission("shift.manage")),
) -> dict:
    shift = ShiftService(db).update(hotel_id, shift_id, payload, current_user.id)
    return ok(ShiftRead.model_validate(shift).model_dump())

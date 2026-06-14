from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.ops_repository import HousekeepingScheduleRepository
from app.schemas.pms import HousekeepingCreate, HousekeepingRead, HousekeepingUpdate
from app.services.pms_service import HousekeepingService

router = APIRouter()


@router.get("")
def list_housekeeping(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    tasks = HousekeepingScheduleRepository(db).list_for_hotel(hotel_id)
    return ok([HousekeepingRead.model_validate(item).model_dump() for item in tasks])


@router.post("")
def create_housekeeping(
    hotel_id: str,
    payload: HousekeepingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    task = HousekeepingService(db).create(hotel_id, payload, current_user.id)
    return ok(HousekeepingRead.model_validate(task).model_dump())


@router.put("/{housekeeping_id}")
def update_housekeeping(
    hotel_id: str,
    housekeeping_id: str,
    payload: HousekeepingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    task = HousekeepingService(db).update(hotel_id, housekeeping_id, payload, current_user.id)
    return ok(HousekeepingRead.model_validate(task).model_dump())

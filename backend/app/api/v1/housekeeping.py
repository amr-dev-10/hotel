from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.permissions import Permissions
from app.core.responses import ok
from app.models.ops import HousekeepingChecklist
from app.models.user import User
from app.repositories.ops_repository import HousekeepingChecklistRepository, HousekeepingScheduleRepository
from app.schemas.pms import (
    HousekeepingChecklistRead,
    HousekeepingChecklistUpsert,
    HousekeepingCreate,
    HousekeepingRead,
    HousekeepingUpdate,
)
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


@router.get("/checklists")
def list_checklists(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("housekeeping.manage")),
) -> dict:
    checklists = HousekeepingChecklistRepository(db).list_for_hotel(hotel_id)
    return ok([HousekeepingChecklistRead.model_validate(item).model_dump() for item in checklists])


@router.put("/checklists/{task_type}")
def upsert_checklist(
    hotel_id: str,
    task_type: str,
    payload: HousekeepingChecklistUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("housekeeping.manage")),
) -> dict:
    repo = HousekeepingChecklistRepository(db)
    checklist = repo.get_for_task_type(hotel_id, task_type)
    if not checklist:
        checklist = HousekeepingChecklist(
            hotel_id=hotel_id,
            task_type=task_type,
            items=payload.items,
        )
        db.add(checklist)
    else:
        checklist.items = payload.items
    db.commit()
    db.refresh(checklist)
    return ok(HousekeepingChecklistRead.model_validate(checklist).model_dump())


@router.put("/{housekeeping_id}")
def update_housekeeping(
    hotel_id: str,
    housekeeping_id: str,
    payload: HousekeepingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    task = HousekeepingService(db).update(hotel_id, housekeeping_id, payload, current_user.id)
    return ok(HousekeepingRead.model_validate(task).model_dump())

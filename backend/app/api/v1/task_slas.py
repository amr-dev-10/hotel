from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.task_type_sla_repository import TaskTypeSLARepository
from app.schemas.v51 import TaskTypeSLACreate, TaskTypeSLARead, TaskTypeSLAUpdate
from app.services.sla_service import SLAService

router = APIRouter()


@router.get("")
def list_task_slas(
    hotel_id: str,
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rows = TaskTypeSLARepository(db).list_for_department(hotel_id, department_id)
    return ok([TaskTypeSLARead.model_validate(item).model_dump() for item in rows])


@router.post("")
def create_task_sla(
    hotel_id: str,
    department_id: str,
    payload: TaskTypeSLACreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    row = SLAService(db).create(hotel_id, department_id, payload)
    return ok(TaskTypeSLARead.model_validate(row).model_dump())


@router.put("/{sla_id}")
def update_task_sla(
    hotel_id: str,
    department_id: str,
    sla_id: str,
    payload: TaskTypeSLAUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    row = SLAService(db).update(hotel_id, department_id, sla_id, payload)
    return ok(TaskTypeSLARead.model_validate(row).model_dump())


@router.delete("/{sla_id}")
def delete_task_sla(
    hotel_id: str,
    department_id: str,
    sla_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    SLAService(db).delete(hotel_id, department_id, sla_id)
    return ok({"deleted": True, "sla_id": sla_id})

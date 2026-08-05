from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.permissions import Permissions
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.task_type_sla_repository import TaskTypeSLARepository
from app.repositories.ticket_category_repository import TicketCategoryRepository
from app.schemas.v51 import TaskTypeSLACreate, TaskTypeSLARead, TaskTypeSLAUpdate
from app.services.sla_service import SLAService

router = APIRouter()


@router.get("")
def list_task_slas(
    hotel_id: str,
    department_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    rows = TaskTypeSLARepository(db).list_for_department(hotel_id, department_id)
    category_names = _category_names(db, hotel_id, [item.ticket_category_id for item in rows])
    return ok([_sla_read(item, category_names).model_dump() for item in rows])


@router.post("")
def create_task_sla(
    hotel_id: str,
    department_id: str,
    payload: TaskTypeSLACreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    row = SLAService(db).create(hotel_id, department_id, payload)
    return ok(_sla_read(row, _category_names(db, hotel_id, [row.ticket_category_id])).model_dump())


@router.put("/{sla_id}")
def update_task_sla(
    hotel_id: str,
    department_id: str,
    sla_id: str,
    payload: TaskTypeSLAUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    row = SLAService(db).update(hotel_id, department_id, sla_id, payload)
    return ok(_sla_read(row, _category_names(db, hotel_id, [row.ticket_category_id])).model_dump())


@router.delete("/{sla_id}")
def delete_task_sla(
    hotel_id: str,
    department_id: str,
    sla_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    SLAService(db).delete(hotel_id, department_id, sla_id)
    return ok({"deleted": True, "sla_id": sla_id})


def _sla_read(row, category_names: dict[str, str]) -> TaskTypeSLARead:
    return TaskTypeSLARead.model_validate(row).model_copy(
        update={"task_category_name": category_names.get(row.ticket_category_id or "")}
    )


def _category_names(db: Session, hotel_id: str, category_ids: list[str | None]) -> dict[str, str]:
    ids = {category_id for category_id in category_ids if category_id}
    if not ids:
        return {}
    rows = TicketCategoryRepository(db).list_active(hotel_id)
    return {row.id: row.name for row in rows if row.id in ids}

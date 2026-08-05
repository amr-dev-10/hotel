from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.permissions import Permissions
from app.core.responses import ok
from app.models.user import User
from app.repositories.ops_repository import MaintenanceOrderRepository
from app.schemas.pms import MaintenanceCreate, MaintenanceRead, MaintenanceUpdate
from app.services.pms_service import MaintenanceService

router = APIRouter()


@router.get("")
def list_maintenance(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    orders = MaintenanceOrderRepository(db).list_for_hotel(hotel_id)
    return ok([MaintenanceRead.model_validate(item).model_dump() for item in orders])


@router.post("")
def create_maintenance(
    hotel_id: str,
    payload: MaintenanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    order = MaintenanceService(db).create(hotel_id, payload, current_user.id)
    return ok(MaintenanceRead.model_validate(order).model_dump())


@router.put("/{maintenance_id}")
def update_maintenance(
    hotel_id: str,
    maintenance_id: str,
    payload: MaintenanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    order = MaintenanceService(db).update(hotel_id, maintenance_id, payload, current_user.id)
    return ok(MaintenanceRead.model_validate(order).model_dump())

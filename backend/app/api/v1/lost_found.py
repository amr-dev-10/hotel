from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.ops_repository import LostFoundRepository
from app.schemas.pms import LostFoundCreate, LostFoundRead, LostFoundUpdate
from app.services.pms_service import LostFoundService

router = APIRouter()


@router.get("")
def list_lost_found(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    items = LostFoundRepository(db).list_for_hotel(hotel_id)
    return ok([LostFoundRead.model_validate(item).model_dump() for item in items])


@router.post("")
def create_lost_found(
    hotel_id: str,
    payload: LostFoundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.create")),
) -> dict:
    item = LostFoundService(db).create(hotel_id, payload, current_user.id)
    return ok(LostFoundRead.model_validate(item).model_dump())


@router.put("/{lost_found_id}")
def update_lost_found(
    hotel_id: str,
    lost_found_id: str,
    payload: LostFoundUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    item = LostFoundService(db).update(hotel_id, lost_found_id, payload, current_user.id)
    return ok(LostFoundRead.model_validate(item).model_dump())

from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.availability_repository import RoomBlockRepository
from app.schemas.availability import AvailabilityQuery, RoomBlockCreate, RoomBlockRead
from app.schemas.room import RoomRead
from app.services.availability_service import AvailabilityService

router = APIRouter()


@router.get("/blocks")
def list_blocks(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.manage")),
) -> dict:
    blocks = RoomBlockRepository(db).list_for_hotel(hotel_id)
    return ok([RoomBlockRead.model_validate(item).model_dump() for item in blocks])


@router.post("/blocks")
def create_block(
    hotel_id: str,
    payload: RoomBlockCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.manage")),
) -> dict:
    block = AvailabilityService(db).block_room(hotel_id, payload, current_user.id)
    return ok(RoomBlockRead.model_validate(block).model_dump())


@router.post("/rooms")
def find_available_rooms(
    hotel_id: str,
    payload: AvailabilityQuery,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.view")),
) -> dict:
    rooms = AvailabilityService(db).find_available_rooms(
        hotel_id,
        payload.room_type_id,
        payload.start_date,
        payload.end_date,
        payload.count,
    )
    return ok([RoomRead.model_validate(item).model_dump() for item in rooms])


@router.get("/calendar")
def availability_calendar(
    hotel_id: str,
    month: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.view")),
) -> dict:
    return ok(AvailabilityService(db).get_availability_calendar(hotel_id, month))

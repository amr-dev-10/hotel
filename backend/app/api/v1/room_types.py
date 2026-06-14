from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import not_found
from app.core.responses import ok
from app.models.room import RoomType
from app.models.user import User
from app.repositories.room_repository import RoomTypeRepository
from app.schemas.room import RoomTypeCreate, RoomTypeRead, RoomTypeUpdate

router = APIRouter()


@router.get("")
def list_room_types(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.view")),
) -> dict:
    room_types = RoomTypeRepository(db).list_for_hotel(hotel_id)
    return ok([RoomTypeRead.model_validate(item).model_dump() for item in room_types])


@router.post("")
def create_room_type(
    hotel_id: str,
    payload: RoomTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.update")),
) -> dict:
    room_type = RoomType(hotel_id=hotel_id, **payload.model_dump())
    RoomTypeRepository(db).add(room_type)
    return ok(RoomTypeRead.model_validate(room_type).model_dump())


@router.put("/{room_type_id}")
def update_room_type(
    hotel_id: str,
    room_type_id: str,
    payload: RoomTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.update")),
) -> dict:
    room_type = RoomTypeRepository(db).get_for_hotel(hotel_id, room_type_id)
    if not room_type:
        raise not_found("Room type not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(room_type, key, value)
    db.commit()
    db.refresh(room_type)
    return ok(RoomTypeRead.model_validate(room_type).model_dump())

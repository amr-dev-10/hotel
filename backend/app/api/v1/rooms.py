from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.room import Room
from app.models.user import User
from app.repositories.room_repository import RoomRepository
from app.schemas.room import RoomCreate, RoomRead

router = APIRouter()


@router.get("")
def list_rooms(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.view")),
) -> dict:
    rooms = RoomRepository(db).list_for_hotel(hotel_id)
    return ok([RoomRead.model_validate(item).model_dump() for item in rooms])


@router.post("")
def create_room(
    hotel_id: str,
    payload: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.update")),
) -> dict:
    room = Room(hotel_id=hotel_id, **payload.model_dump())
    RoomRepository(db).add(room)
    return ok(RoomRead.model_validate(room).model_dump())

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import not_found
from app.core.responses import ok
from app.models.room import Room
from app.models.user import User
from app.repositories.room_repository import RoomRepository, RoomTypeRepository
from app.schemas.room import RoomCreate, RoomRead, RoomUpdate

router = APIRouter()


@router.get("")
def list_rooms(
    hotel_id: str,
    q: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.view")),
) -> dict:
    rooms = RoomRepository(db).list_for_hotel(hotel_id, limit=limit, q=q)
    return ok([RoomRead.model_validate(item).model_dump() for item in rooms])


@router.post("")
def create_room(
    hotel_id: str,
    payload: RoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.create")),
) -> dict:
    if payload.room_type_id and not RoomTypeRepository(db).get_for_hotel(hotel_id, payload.room_type_id):
        raise not_found("Room type not found")
    room = Room(hotel_id=hotel_id, **payload.model_dump())
    RoomRepository(db).add(room)
    return ok(RoomRead.model_validate(room).model_dump())


@router.get("/{room_id}")
def get_room(
    hotel_id: str,
    room_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.view")),
) -> dict:
    room = RoomRepository(db).get_for_hotel(hotel_id, room_id)
    if not room:
        raise not_found("Room not found")
    return ok(RoomRead.model_validate(room).model_dump())


@router.patch("/{room_id}")
def update_room(
    hotel_id: str,
    room_id: str,
    payload: RoomUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.update")),
) -> dict:
    repo = RoomRepository(db)
    room = repo.get_for_hotel(hotel_id, room_id)
    if not room:
        raise not_found("Room not found")
    if payload.room_type_id and not RoomTypeRepository(db).get_for_hotel(hotel_id, payload.room_type_id):
        raise not_found("Room type not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return ok(RoomRead.model_validate(room).model_dump())

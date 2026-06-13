from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.hotel.dependencies import ensure_hotel_scope
from app.modules.room.models import Room
from app.modules.room.schemas import RoomCreate, RoomRead, RoomUpdate

router = APIRouter(prefix="/hotels/{hotel_id}/rooms", tags=["rooms"])


def _room_to_read(room: Room) -> RoomRead:
    return RoomRead(
        id=room.id,
        hotel_id=room.tenant_id,
        room_number=room.room_number,
        room_type=room.room_type,
        status=room.status,
    )


def _get_room(db: Session, hotel_id: str, room_id: str) -> Room:
    room = db.scalar(select(Room).where(Room.tenant_id == hotel_id, Room.id == room_id))
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    return room


@router.get("", response_model=list[RoomRead])
def list_rooms(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[RoomRead]:
    ensure_hotel_scope(hotel_id, context)
    rooms = db.scalars(select(Room).where(Room.tenant_id == hotel_id).order_by(Room.room_number)).all()
    return [_room_to_read(room) for room in rooms]


@router.post("", response_model=RoomRead, status_code=201)
def create_room(
    hotel_id: str,
    payload: RoomCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> RoomRead:
    ensure_hotel_scope(hotel_id, context)
    room = Room(tenant_id=hotel_id, **payload.model_dump())
    db.add(room)
    db.commit()
    db.refresh(room)
    return _room_to_read(room)


@router.put("/{room_id}", response_model=RoomRead)
def update_room(
    hotel_id: str,
    room_id: str,
    payload: RoomUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> RoomRead:
    ensure_hotel_scope(hotel_id, context)
    room = _get_room(db, hotel_id, room_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, key, value)
    db.commit()
    db.refresh(room)
    return _room_to_read(room)


@router.delete("/{room_id}", status_code=204)
def delete_room(
    hotel_id: str,
    room_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Response:
    ensure_hotel_scope(hotel_id, context)
    room = _get_room(db, hotel_id, room_id)
    db.delete(room)
    db.commit()
    return Response(status_code=204)

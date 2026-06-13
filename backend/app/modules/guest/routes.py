from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.guest.models import Guest
from app.modules.guest.schemas import GuestCreate, GuestRead, GuestUpdate
from app.modules.hotel.dependencies import ensure_hotel_scope
from app.modules.room.models import Room

router = APIRouter(prefix="/hotels/{hotel_id}/guests", tags=["guests"])


def _guest_to_read(guest: Guest) -> GuestRead:
    return GuestRead(
        id=guest.id,
        hotel_id=guest.tenant_id,
        room_id=guest.room_id,
        name=guest.name,
        phone=guest.phone,
        whatsapp_phone=guest.whatsapp_phone,
        check_in_date=guest.check_in_date,
        check_out_date=guest.check_out_date,
        status=guest.status,
    )


def _get_guest(db: Session, hotel_id: str, guest_id: str) -> Guest:
    guest = db.scalar(select(Guest).where(Guest.tenant_id == hotel_id, Guest.id == guest_id))
    if guest is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Guest not found")
    return guest


def _mark_room(db: Session, hotel_id: str, room_id: str | None, status_value: str) -> None:
    if room_id is None:
        return
    room = db.scalar(select(Room).where(Room.tenant_id == hotel_id, Room.id == room_id))
    if room is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    room.status = status_value


@router.get("", response_model=list[GuestRead])
def list_guests(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[GuestRead]:
    ensure_hotel_scope(hotel_id, context)
    guests = db.scalars(select(Guest).where(Guest.tenant_id == hotel_id).order_by(Guest.created_at.desc())).all()
    return [_guest_to_read(guest) for guest in guests]


@router.post("", response_model=GuestRead, status_code=201)
def check_in_guest(
    hotel_id: str,
    payload: GuestCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> GuestRead:
    ensure_hotel_scope(hotel_id, context)
    _mark_room(db, hotel_id, payload.room_id, "occupied")
    guest = Guest(tenant_id=hotel_id, **payload.model_dump())
    db.add(guest)
    db.commit()
    db.refresh(guest)
    return _guest_to_read(guest)


@router.get("/{guest_id}", response_model=GuestRead)
def get_guest(
    hotel_id: str,
    guest_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> GuestRead:
    ensure_hotel_scope(hotel_id, context)
    return _guest_to_read(_get_guest(db, hotel_id, guest_id))


@router.put("/{guest_id}", response_model=GuestRead)
def update_guest(
    hotel_id: str,
    guest_id: str,
    payload: GuestUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> GuestRead:
    ensure_hotel_scope(hotel_id, context)
    guest = _get_guest(db, hotel_id, guest_id)
    updates = payload.model_dump(exclude_unset=True)
    old_room_id = guest.room_id
    for key, value in updates.items():
        setattr(guest, key, value)
    if "room_id" in updates and old_room_id != guest.room_id:
        _mark_room(db, hotel_id, old_room_id, "available")
        _mark_room(db, hotel_id, guest.room_id, "occupied")
    db.commit()
    db.refresh(guest)
    return _guest_to_read(guest)


@router.post("/{guest_id}/checkout", response_model=GuestRead)
def check_out_guest(
    hotel_id: str,
    guest_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> GuestRead:
    ensure_hotel_scope(hotel_id, context)
    guest = _get_guest(db, hotel_id, guest_id)
    guest.status = "checked_out"
    guest.check_out_date = datetime.now(timezone.utc).isoformat()
    _mark_room(db, hotel_id, guest.room_id, "available")
    db.commit()
    db.refresh(guest)
    return _guest_to_read(guest)

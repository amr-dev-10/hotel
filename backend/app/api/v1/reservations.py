from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import bad_request, not_found
from app.core.responses import ok
from app.models.guest import Guest
from app.models.room import Room
from app.models.user import User
from app.repositories.reservation_repository import (
    ReservationRepository,
    ReservationRoomTypeRepository,
    StayRecordRepository,
)
from app.schemas.reservation import (
    ReservationCheckInRequest,
    ReservationCancelRequest,
    ReservationCreate,
    ReservationDetail,
    ReservationGuestNew,
    ReservationGuestRead,
    ReservationListItem,
    ReservationRead,
    ReservationRoomTypeRead,
    ReservationUpdate,
    RoomChangeRequest,
    StayRecordRead,
)
from app.services.reservation_service import ReservationService

router = APIRouter()


@router.get("")
def list_reservations(
    hotel_id: str,
    q: str | None = None,
    status: str | None = None,
    from_date: date | None = Query(default=None, alias="from"),
    to_date: date | None = Query(default=None, alias="to"),
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    try:
        repo = ReservationRepository(db)
        page = repo.list_filtered(
            hotel_id,
            q=q,
            status=status,
            from_date=from_date,
            to_date=to_date,
            cursor=cursor,
            limit=limit,
        )
        total = repo.count_filtered(
            hotel_id,
            q=q,
            status=status,
            from_date=from_date,
            to_date=to_date,
        )
    except ValueError:
        raise bad_request("Invalid pagination cursor") from None
    guest_context = _guest_context(db, hotel_id, [item.guest_id for item in page.items])
    room_context = _room_context(db, hotel_id, [item.room_id for item in page.items if item.room_id])
    items = []
    for item in page.items:
        data = ReservationListItem.model_validate(item).model_dump()
        guest = guest_context.get(item.guest_id)
        if guest:
            data["guest_name"] = guest["name"]
            data["guest_phone"] = guest["phone"]
        room = room_context.get(item.room_id)
        if room:
            data["room_number"] = room["room_number"]
            data["room_type"] = room["room_type"]
        items.append(data)
    return ok(
        items,
        meta={"next_cursor": page.next_cursor, "has_more": page.has_more, "limit": page.limit, "total": total},
    )


@router.post("")
def create_reservation(
    hotel_id: str,
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.create")),
) -> dict:
    reservation = ReservationService(db).create_reservation(
        hotel_id,
        payload,
        actor_id=current_user.id,
    )
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.get("/{reservation_id}")
def get_reservation(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    reservation = ReservationRepository(db).get_for_hotel(hotel_id, reservation_id)
    if not reservation:
        raise not_found("Reservation not found")
    return ok(ReservationDetail.model_validate(reservation).model_dump())


@router.put("/{reservation_id}")
def update_reservation(
    hotel_id: str,
    reservation_id: str,
    payload: ReservationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    reservation = ReservationService(db).update_reservation(
        hotel_id,
        reservation_id,
        payload,
        actor_id=current_user.id,
    )
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.get("/{reservation_id}/guests")
def list_reservation_guests(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    guests = ReservationService(db).list_guests(hotel_id, reservation_id)
    return ok([ReservationGuestRead.model_validate(item).model_dump() for item in guests])


@router.post("/{reservation_id}/guests")
def add_reservation_guest(
    hotel_id: str,
    reservation_id: str,
    payload: ReservationGuestNew,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    guest_link = ReservationService(db).add_guest(hotel_id, reservation_id, payload, current_user.id)
    return ok(ReservationGuestRead.model_validate(guest_link).model_dump())


@router.post("/{reservation_id}/check-in")
def check_in(
    hotel_id: str,
    reservation_id: str,
    payload: ReservationCheckInRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.create")),
) -> dict:
    reservation = ReservationService(db).check_in(hotel_id, reservation_id, current_user.id, payload)
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.post("/{reservation_id}/checkin")
def checkin_alias(
    hotel_id: str,
    reservation_id: str,
    payload: ReservationCheckInRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.create")),
) -> dict:
    reservation = ReservationService(db).check_in(hotel_id, reservation_id, current_user.id, payload)
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.post("/{reservation_id}/check-out")
def check_out(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.checkout")),
) -> dict:
    reservation = ReservationService(db).check_out(hotel_id, reservation_id, current_user.id)
    return ok(ReservationRead.model_validate(reservation).model_dump())

@router.get("/{reservation_id}/messages")
def get_reservation_messages(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    from app.models.whatsapp import WhatsAppMessage
    from app.schemas.whatsapp_account import WhatsAppMessageRead
    from sqlalchemy import select
    
    messages = db.execute(
        select(WhatsAppMessage).where(
            WhatsAppMessage.hotel_id == hotel_id,
            WhatsAppMessage.reservation_id == reservation_id,
        ).order_by(WhatsAppMessage.created_at)
    ).scalars().all()
    
    return ok([WhatsAppMessageRead.model_validate(msg).model_dump() for msg in messages])


@router.post("/{reservation_id}/checkout")
def checkout_alias(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.checkout")),
) -> dict:
    reservation = ReservationService(db).check_out(hotel_id, reservation_id, current_user.id)
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.post("/{reservation_id}/cancel")
def cancel_reservation(
    hotel_id: str,
    reservation_id: str,
    payload: ReservationCancelRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.cancel")),
) -> dict:
    reservation = ReservationService(db).cancel_reservation(
        hotel_id,
        reservation_id,
        reason=payload.reason if payload else None,
        actor_id=current_user.id,
    )
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.post("/{reservation_id}/change-room")
def change_room(
    hotel_id: str,
    reservation_id: str,
    payload: RoomChangeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    reservation = ReservationService(db).change_room(
        hotel_id,
        reservation_id,
        payload,
        current_user.id,
    )
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.get("/{reservation_id}/stays")
def list_stay_records(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    stays = StayRecordRepository(db).list_for_reservation(hotel_id, reservation_id)
    return ok([StayRecordRead.model_validate(item).model_dump() for item in stays])


@router.get("/{reservation_id}/room-types")
def list_reservation_room_types(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    rows = ReservationRoomTypeRepository(db).list_for_reservation(hotel_id, reservation_id)
    return ok([ReservationRoomTypeRead.model_validate(item).model_dump() for item in rows])


def _guest_context(db: Session, hotel_id: str, guest_ids: list[str]) -> dict[str, dict[str, str | None]]:
    if not guest_ids:
        return {}
    rows = db.execute(
        select(Guest.id, Guest.name, Guest.phone).where(
            Guest.hotel_id == hotel_id,
            Guest.id.in_(set(guest_ids)),
        )
    ).all()
    return {guest_id: {"name": name, "phone": phone} for guest_id, name, phone in rows}


def _room_context(db: Session, hotel_id: str, room_ids: list[str]) -> dict[str, dict[str, str | None]]:
    if not room_ids:
        return {}
    rows = db.execute(
        select(Room.id, Room.room_number, Room.room_type).where(
            Room.hotel_id == hotel_id,
            Room.id.in_(set(room_ids)),
        )
    ).all()
    return {
        room_id: {"room_number": room_number, "room_type": room_type}
        for room_id, room_number, room_type in rows
    }

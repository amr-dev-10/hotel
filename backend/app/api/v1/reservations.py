from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import not_found
from app.core.responses import ok
from app.models.user import User
from app.repositories.reservation_repository import (
    ReservationRepository,
    ReservationRoomTypeRepository,
    StayRecordRepository,
)
from app.schemas.reservation import (
    ReservationCheckInRequest,
    ReservationCreate,
    ReservationGuestNew,
    ReservationGuestRead,
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
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    reservations = ReservationRepository(db).list_for_hotel(hotel_id)
    return ok([ReservationRead.model_validate(item).model_dump() for item in reservations])


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
    return ok(ReservationRead.model_validate(reservation).model_dump())


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


@router.post("/{reservation_id}/checkout")
def checkout_alias(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.checkout")),
) -> dict:
    reservation = ReservationService(db).check_out(hotel_id, reservation_id, current_user.id)
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

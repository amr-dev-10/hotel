from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.reservation_repository import ReservationRepository
from app.schemas.reservation import ReservationCreate, ReservationRead
from app.services.reservation_service import ReservationService

router = APIRouter()


@router.get("")
def list_reservations(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.view")),
) -> dict:
    reservations = ReservationRepository(db).list_for_hotel(hotel_id)
    return ok([ReservationRead.model_validate(item).model_dump() for item in reservations])


@router.post("")
def create_reservation(
    hotel_id: str,
    payload: ReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.manage")),
) -> dict:
    reservation = ReservationService(db).create_reservation(
        hotel_id,
        payload,
        actor_id=current_user.id,
    )
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.post("/{reservation_id}/check-in")
def check_in(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.manage")),
) -> dict:
    reservation = ReservationService(db).check_in(hotel_id, reservation_id, current_user.id)
    return ok(ReservationRead.model_validate(reservation).model_dump())


@router.post("/{reservation_id}/check-out")
def check_out(
    hotel_id: str,
    reservation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("reservation.manage")),
) -> dict:
    reservation = ReservationService(db).check_out(hotel_id, reservation_id, current_user.id)
    return ok(ReservationRead.model_validate(reservation).model_dump())

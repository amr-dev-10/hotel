from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.guest import Guest
from app.models.user import User
from app.repositories.guest_repository import GuestRepository
from app.schemas.guest import GuestCreate, GuestRead

router = APIRouter()


@router.get("")
def list_guests(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    guests = GuestRepository(db).list_for_hotel(hotel_id)
    return ok([GuestRead.model_validate(item).model_dump() for item in guests])


@router.post("")
def create_guest(
    hotel_id: str,
    payload: GuestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    guest = Guest(hotel_id=hotel_id, **payload.model_dump())
    GuestRepository(db).add(guest)
    return ok(GuestRead.model_validate(guest).model_dump())

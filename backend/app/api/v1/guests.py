from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.guest import Guest
from app.models.user import User
from app.repositories.guest_repository import GuestRepository
from app.schemas.consent import GuestConsentRead, GuestConsentUpsert
from app.schemas.guest import GuestCreate, GuestRead
from app.services.consent_service import GuestConsentService

router = APIRouter()


@router.get("")
def list_guests(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    guests = GuestRepository(db).list_for_hotel(hotel_id)
    return ok([GuestRead.model_validate(item).model_dump() for item in guests])


@router.post("")
def create_guest(
    hotel_id: str,
    payload: GuestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.create")),
) -> dict:
    guest = Guest(hotel_id=hotel_id, **payload.model_dump())
    GuestRepository(db).add(guest)
    return ok(GuestRead.model_validate(guest).model_dump())


@router.get("/{guest_id}/consent")
def get_guest_consent(
    hotel_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    consent = GuestConsentService(db).get(hotel_id, guest_id)
    return ok(GuestConsentRead.model_validate(consent).model_dump() if consent else None)


@router.put("/{guest_id}/consent")
def upsert_guest_consent(
    hotel_id: str,
    guest_id: str,
    payload: GuestConsentUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    consent = GuestConsentService(db).upsert(hotel_id, guest_id, payload)
    return ok(GuestConsentRead.model_validate(consent).model_dump())

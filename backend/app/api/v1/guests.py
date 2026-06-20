from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.guest import Guest
from app.models.user import User
from app.repositories.guest_repository import GuestRepository
from app.schemas.consent import GuestConsentRead, GuestConsentUpsert
from app.schemas.guest import GuestCreate, GuestRead, GuestUpdate, TimelineEvent
from app.services.consent_service import GuestConsentService
from app.models.reservation import Reservation
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.models.ticket import Ticket
from sqlalchemy import select

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


@router.get("/{guest_id}")
def get_guest(
    hotel_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    guest = GuestRepository(db).get_for_hotel(hotel_id, guest_id)
    if not guest:
        return {"error": "Not found"}
    return ok(GuestRead.model_validate(guest).model_dump())

@router.patch("/{guest_id}")
def update_guest(
    hotel_id: str,
    guest_id: str,
    payload: GuestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    guest = GuestRepository(db).get_for_hotel(hotel_id, guest_id)
    if not guest:
        return {"error": "Not found"}
        
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(guest, key, value)
        
    db.commit()
    db.refresh(guest)
    return ok(GuestRead.model_validate(guest).model_dump())

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

@router.get("/{guest_id}/timeline")
def get_guest_timeline(
    hotel_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    events = []
    
    # 1. Reservations
    reservations = db.execute(
        select(Reservation).where(Reservation.hotel_id == hotel_id, Reservation.guest_id == guest_id)
    ).scalars().all()
    for res in reservations:
        events.append(TimelineEvent(
            event_type="reservation",
            timestamp=res.created_at.isoformat(),
            id=res.id,
            title=f"Reservation {res.reservation_no}",
            description=f"Status: {res.status}",
            status=res.status,
            metadata={"checkin_date": res.checkin_date.isoformat(), "checkout_date": res.checkout_date.isoformat()}
        ))
        
    # 2. WhatsApp Messages
    messages = db.execute(
        select(WhatsAppMessage).join(WhatsAppConversation).where(
            WhatsAppMessage.hotel_id == hotel_id,
            WhatsAppConversation.guest_id == guest_id
        )
    ).scalars().all()
    for msg in messages:
        events.append(TimelineEvent(
            event_type="whatsapp_message",
            timestamp=msg.created_at.isoformat(),
            id=msg.id,
            title="WhatsApp Message",
            description=msg.message_text or msg.message_type,
            status=msg.status,
            metadata={"direction": msg.direction}
        ))
        
    # 3. Tickets
    tickets = db.execute(
        select(Ticket).where(Ticket.hotel_id == hotel_id, Ticket.guest_id == guest_id)
    ).scalars().all()
    for tkt in tickets:
        events.append(TimelineEvent(
            event_type="ticket",
            timestamp=tkt.created_at.isoformat(),
            id=tkt.id,
            title=f"Ticket #{tkt.ticket_number}",
            description=tkt.title,
            status=tkt.status,
            metadata={"priority": tkt.priority, "category": tkt.category}
        ))
        
    # Sort by timestamp descending
    events.sort(key=lambda x: x.timestamp, reverse=True)
    
    return ok([e.model_dump() for e in events])


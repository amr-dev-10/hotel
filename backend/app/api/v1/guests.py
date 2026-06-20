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
from app.models.reservation import Reservation, ReservationGuest
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.models.ticket import Ticket
from sqlalchemy import select, or_

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
    
    # 1. Reservations — find via direct guest_id OR via ReservationGuest join table
    # This covers both reservation creation paths (direct guest_id and linked via join table)
    via_join = db.execute(
        select(ReservationGuest.reservation_id).where(
            ReservationGuest.hotel_id == hotel_id,
            ReservationGuest.guest_id == guest_id
        )
    ).scalars().all()

    reservations = db.execute(
        select(Reservation).where(
            Reservation.hotel_id == hotel_id,
            or_(
                Reservation.guest_id == guest_id,
                Reservation.id.in_(via_join)
            )
        )
    ).scalars().all()

    seen_ids = set()
    for res in reservations:
        if res.id in seen_ids:
            continue
        seen_ids.add(res.id)
        events.append(TimelineEvent(
            event_type="reservation",
            timestamp=res.created_at.isoformat(),
            id=res.id,
            title=f"Reservation {res.reservation_no}",
            description=f"Status: {res.status}",
            status=res.status,
            metadata={"checkin_date": res.checkin_date.isoformat(), "checkout_date": res.checkout_date.isoformat()}
        ))

    # Sort by timestamp descending
    events.sort(key=lambda x: x.timestamp, reverse=True)
    
    return ok([e.model_dump() for e in events])

@router.get("/{guest_id}/conversation")
def get_guest_conversation(
    hotel_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    from fastapi import HTTPException
    
    guest = db.execute(select(Guest).where(Guest.hotel_id == hotel_id, Guest.id == guest_id)).scalar_one_or_none()
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
        
    conversation = db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.hotel_id == hotel_id,
            WhatsAppConversation.guest_id == guest_id
        )
    ).scalar_one_or_none()
    
    if not conversation:
        phone = guest.whatsapp_phone or guest.phone
        if not phone:
            raise HTTPException(status_code=400, detail="Guest has no phone number to create WhatsApp conversation")
            
        # check if there's already a conversation with this phone number but no guest_id
        conversation = db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.hotel_id == hotel_id,
                WhatsAppConversation.phone == phone
            )
        ).scalar_one_or_none()
        
        if conversation:
            conversation.guest_id = guest_id
        else:
            conversation = WhatsAppConversation(
                hotel_id=hotel_id,
                guest_id=guest_id,
                phone=phone,
                status="open",
                unread_count=0
            )
            db.add(conversation)
        
        db.commit()
        db.refresh(conversation)

    # find active reservation for context
    active_reservation_id = None
    reservations = db.execute(
        select(Reservation).where(
            Reservation.hotel_id == hotel_id,
            Reservation.guest_id == guest_id
        ).order_by(Reservation.created_at.desc())
    ).scalars().all()
    
    if reservations:
        # Priority: Checked In > Pre Arrival > Most Recent
        checked_in = next((r for r in reservations if r.status == "checked_in"), None)
        if checked_in:
            active_reservation_id = checked_in.id
        else:
            pre_arrival = next((r for r in reservations if r.status in ["pre_arrival", "booked", "confirmed"]), None)
            if pre_arrival:
                active_reservation_id = pre_arrival.id
            else:
                active_reservation_id = reservations[0].id
                
    return ok({
        "conversation_id": conversation.id,
        "reservation_id": active_reservation_id
    })


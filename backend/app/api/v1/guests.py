from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import bad_request, not_found
from app.core.responses import ok
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.user import User
from app.repositories.guest_repository import GuestRepository
from app.schemas.consent import GuestConsentRead, GuestConsentUpsert
from app.schemas.guest import GuestCreate, GuestDetail, GuestListItem, GuestRead, GuestUpdate, TimelineEvent
from app.services.consent_service import GuestConsentService
from app.services.whatsapp_contact_sync import sync_guest_whatsapp_contact
from app.models.reservation import Reservation, ReservationGuest
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.models.ticket import Ticket
from app.services.audit_service import AuditService

router = APIRouter()


@router.get("")
def list_guests(
    hotel_id: str,
    q: str | None = None,
    status: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    try:
        repo = GuestRepository(db)
        page = repo.list_filtered(
            hotel_id,
            q=q,
            status=status,
            cursor=cursor,
            limit=limit,
        )
        total = repo.count_filtered(hotel_id, q=q, status=status)
    except ValueError:
        raise bad_request("Invalid pagination cursor") from None
    guest_context = _guest_list_context(db, hotel_id, [item.id for item in page.items])
    items = []
    for item in page.items:
        data = GuestListItem.model_validate(item).model_dump()
        context = guest_context.get(item.id)
        if context:
            data.update(context)
        items.append(data)
    return ok(
        items,
        meta={"next_cursor": page.next_cursor, "has_more": page.has_more, "limit": page.limit, "total": total},
    )


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
        raise not_found("Guest not found")
    return ok(GuestDetail.model_validate(guest).model_dump())

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
    if {"phone", "whatsapp_phone"} & update_data.keys():
        sync_guest_whatsapp_contact(db, guest)
        
    db.commit()
    db.refresh(guest)
    return ok(GuestRead.model_validate(guest).model_dump())


@router.delete("/{guest_id}")
def delete_guest(
    hotel_id: str,
    guest_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    repo = GuestRepository(db)
    guest = repo.get_for_hotel(hotel_id, guest_id)
    if not guest:
        raise not_found("Guest not found")

    linked_conversations = db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.hotel_id == hotel_id,
            WhatsAppConversation.guest_id == guest_id,
        )
    ).scalars().all()
    for conversation in linked_conversations:
        conversation.guest_id = None

    AuditService(db).log(
        hotel_id,
        "guest.deleted",
        "guest",
        guest.id,
        current_user.id,
        payload={"name": guest.name, "linked_conversations": len(linked_conversations)},
    )
    repo.soft_delete(guest, utcnow(), current_user.id)
    return ok({"deleted": True, "guest_id": guest_id})


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
        
        if conversation and conversation.guest_id == guest_id:
            pass
        elif conversation and not conversation.guest_id:
            # Link existing phone conversation to this guest
            conversation.guest_id = guest_id
        else:
            from app.models.base import utcnow
            conversation = WhatsAppConversation(
                hotel_id=hotel_id,
                guest_id=guest_id,
                phone=phone,
                status="open",
                priority="normal",
                unread_count=0,
                started_at=utcnow(),
            )
            db.add(conversation)
        
        db.commit()
        db.refresh(conversation)
    else:
        sync_guest_whatsapp_contact(db, guest)
        db.commit()
        db.refresh(conversation)

    # find active reservation for context
    active_reservation_id = None
    via_join = db.execute(
        select(ReservationGuest.reservation_id).where(
            ReservationGuest.hotel_id == hotel_id,
            ReservationGuest.guest_id == guest_id,
        )
    ).scalars().all()
    reservations = db.execute(
        select(Reservation).where(
            Reservation.hotel_id == hotel_id,
            or_(
                Reservation.guest_id == guest_id,
                Reservation.id.in_(via_join),
            )
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


def _guest_list_context(db: Session, hotel_id: str, guest_ids: list[str]) -> dict[str, dict[str, int | bool]]:
    if not guest_ids:
        return {}
    id_set = set(guest_ids)
    context: dict[str, dict[str, int | bool]] = {
        guest_id: {"reservation_count": 0, "has_whatsapp_conversation": False}
        for guest_id in id_set
    }
    direct_counts = db.execute(
        select(Reservation.guest_id, func.count(Reservation.id))
        .where(
            Reservation.hotel_id == hotel_id,
            Reservation.guest_id.in_(id_set),
            Reservation.deleted_at.is_(None),
        )
        .group_by(Reservation.guest_id)
    ).all()
    for guest_id, count in direct_counts:
        context[guest_id]["reservation_count"] = int(count)
    linked_counts = db.execute(
        select(ReservationGuest.guest_id, func.count(ReservationGuest.reservation_id.distinct()))
        .where(
            ReservationGuest.hotel_id == hotel_id,
            ReservationGuest.guest_id.in_(id_set),
        )
        .group_by(ReservationGuest.guest_id)
    ).all()
    for guest_id, count in linked_counts:
        context[guest_id]["reservation_count"] = max(
            int(context[guest_id]["reservation_count"]),
            int(count),
        )
    conversations = db.execute(
        select(WhatsAppConversation.guest_id).where(
            WhatsAppConversation.hotel_id == hotel_id,
            WhatsAppConversation.guest_id.in_(id_set),
        )
    ).scalars().all()
    for guest_id in conversations:
        context[guest_id]["has_whatsapp_conversation"] = True
    return context

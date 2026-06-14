import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.feedback.models import Feedback
from app.modules.guest.models import Guest
from app.modules.hotel.dependencies import ensure_hotel_scope
from app.modules.hotel.schemas import HotelCreate, HotelRead, HotelStats, HotelUpdate
from app.modules.room.models import Room
from app.modules.tenant.models import Tenant
from app.modules.ticket.models import Ticket
from app.modules.user.models import User

router = APIRouter(prefix="/hotels", tags=["hotels"])


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "hotel"


def _unique_subdomain(db: Session, name: str, preferred: str | None) -> str:
    base = preferred or _slugify(name)
    candidate = base
    suffix = 2
    while db.scalar(select(Tenant.id).where(Tenant.subdomain == candidate)) is not None:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


def _get_hotel(db: Session, hotel_id: str) -> Tenant:
    hotel = db.scalar(select(Tenant).where(Tenant.id == hotel_id))
    if hotel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hotel not found")
    return hotel


@router.post("", response_model=HotelRead, status_code=201)
def create_hotel(payload: HotelCreate, db: Session = Depends(get_db)) -> Tenant:
    hotel = Tenant(
        name=payload.name,
        subdomain=_unique_subdomain(db, payload.name, payload.subdomain),
        email=payload.contact_email,
        phone=payload.contact_phone,
        address=payload.address,
        contact_email=payload.contact_email,
        contact_phone=payload.contact_phone,
        whatsapp_phone_number_id=payload.whatsapp_phone_number_id,
        timezone=payload.timezone,
        subscription=payload.subscription,
        status=payload.status,
    )
    db.add(hotel)
    db.commit()
    db.refresh(hotel)
    return hotel


@router.get("/{hotel_id}", response_model=HotelRead)
def get_hotel(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Tenant:
    ensure_hotel_scope(hotel_id, context)
    return _get_hotel(db, hotel_id)


@router.put("/{hotel_id}", response_model=HotelRead)
def update_hotel(
    hotel_id: str,
    payload: HotelUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Tenant:
    ensure_hotel_scope(hotel_id, context)
    hotel = _get_hotel(db, hotel_id)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(hotel, key, value)
    if "contact_email" in updates:
        hotel.email = updates["contact_email"]
    if "contact_phone" in updates:
        hotel.phone = updates["contact_phone"]
    db.commit()
    db.refresh(hotel)
    return hotel


@router.get("/{hotel_id}/stats", response_model=HotelStats)
def hotel_stats(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> HotelStats:
    ensure_hotel_scope(hotel_id, context)
    total_staff = db.scalar(select(func.count()).select_from(User).where(User.tenant_id == hotel_id)) or 0
    total_rooms = db.scalar(select(func.count()).select_from(Room).where(Room.tenant_id == hotel_id)) or 0
    occupied_rooms = (
        db.scalar(select(func.count()).select_from(Room).where(Room.tenant_id == hotel_id, Room.status == "occupied"))
        or 0
    )
    active_guests = (
        db.scalar(select(func.count()).select_from(Guest).where(Guest.tenant_id == hotel_id, Guest.status == "checked_in"))
        or 0
    )
    open_tickets = (
        db.scalar(
            select(func.count())
            .select_from(Ticket)
            .where(Ticket.tenant_id == hotel_id, Ticket.stage.not_in(["completed", "closed"]))
        )
        or 0
    )
    closed_tickets = (
        db.scalar(
            select(func.count()).select_from(Ticket).where(Ticket.tenant_id == hotel_id, Ticket.stage.in_(["completed", "closed"]))
        )
        or 0
    )
    feedback_count = db.scalar(select(func.count()).select_from(Feedback).where(Feedback.tenant_id == hotel_id)) or 0
    return HotelStats(
        total_staff=total_staff,
        total_rooms=total_rooms,
        occupied_rooms=occupied_rooms,
        active_guests=active_guests,
        open_tickets=open_tickets,
        closed_tickets=closed_tickets,
        feedback_count=feedback_count,
    )

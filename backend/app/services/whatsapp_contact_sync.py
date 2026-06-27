from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guest import Guest
from app.models.whatsapp import WhatsAppConversation
from app.models.whatsapp_session import WhatsAppSession


def preferred_guest_whatsapp_phone(guest: Guest) -> str | None:
    return guest.whatsapp_phone or guest.phone


def sync_guest_whatsapp_contact(db: Session, guest: Guest) -> str | None:
    phone = preferred_guest_whatsapp_phone(guest)
    if not phone:
        return None

    conversations = db.execute(
        select(WhatsAppConversation).where(
            WhatsAppConversation.hotel_id == guest.hotel_id,
            WhatsAppConversation.guest_id == guest.id,
        )
    ).scalars().all()
    for conversation in conversations:
        if conversation.phone != phone:
            conversation.phone = phone

    sessions = db.execute(
        select(WhatsAppSession).where(
            WhatsAppSession.hotel_id == guest.hotel_id,
            WhatsAppSession.guest_id == guest.id,
        )
    ).scalars().all()
    for session in sessions:
        if session.phone == phone:
            continue
        existing = db.execute(
            select(WhatsAppSession).where(
                WhatsAppSession.hotel_id == guest.hotel_id,
                WhatsAppSession.phone == phone,
                WhatsAppSession.id != session.id,
            )
        ).scalar_one_or_none()
        if existing:
            if not existing.guest_id:
                existing.guest_id = guest.id
            if not existing.whatsapp_account_id and session.whatsapp_account_id:
                existing.whatsapp_account_id = session.whatsapp_account_id
            continue
        session.phone = phone

    return phone

from uuid import uuid4

from sqlalchemy import select

from app.core.database import SessionLocal, init_db
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.whatsapp import WhatsAppConversation
from app.repositories.whatsapp_repository import WhatsAppConversationRepository


def _hotel_with_guest(db, guest_name: str = "Test Guest") -> tuple[Hotel, Guest]:
    suffix = uuid4().hex[:8]
    hotel = Hotel(slug=f"wa-repo-{suffix}", name="WhatsApp Repo Hotel")
    db.add(hotel)
    db.flush()
    guest = Guest(
        hotel_id=hotel.id,
        name=guest_name,
        phone=f"+1555{suffix}",
        whatsapp_phone=f"+1555{suffix}",
    )
    db.add(guest)
    db.flush()
    return hotel, guest


def _conversation(
    hotel_id: str,
    phone: str,
    guest_id: str | None = None,
) -> WhatsAppConversation:
    return WhatsAppConversation(
        hotel_id=hotel_id,
        guest_id=guest_id,
        phone=phone,
        status="open",
        priority="normal",
        started_at=utcnow(),
        last_message_at=utcnow(),
    )


def test_get_or_create_reuses_existing_guest_conversation_before_linking_phone_row() -> None:
    init_db()
    db = SessionLocal()
    try:
        hotel, guest = _hotel_with_guest(db)
        existing_guest_conversation = _conversation(hotel.id, "+15550000001", guest.id)
        anonymous_phone_conversation = _conversation(hotel.id, "+15550000002")
        db.add_all([existing_guest_conversation, anonymous_phone_conversation])
        db.flush()

        result = WhatsAppConversationRepository(db).get_or_create(
            hotel.id,
            "+15550000002",
            guest.id,
        )
        db.flush()

        assert result.id == existing_guest_conversation.id
        assert result.phone == "+15550000002"
        assert anonymous_phone_conversation.guest_id is None
        guest_conversation_ids = db.execute(
            select(WhatsAppConversation.id).where(
                WhatsAppConversation.hotel_id == hotel.id,
                WhatsAppConversation.guest_id == guest.id,
            )
        ).scalars().all()
        assert guest_conversation_ids == [existing_guest_conversation.id]
    finally:
        db.rollback()
        db.close()


def test_get_or_create_does_not_reuse_phone_row_for_different_guest() -> None:
    init_db()
    db = SessionLocal()
    try:
        hotel, first_guest = _hotel_with_guest(db, "First Guest")
        second_guest = Guest(
            hotel_id=hotel.id,
            name="Second Guest",
            phone="+15550000003",
            whatsapp_phone="+15550000003",
        )
        db.add(second_guest)
        db.flush()
        first_guest_conversation = _conversation(hotel.id, "+15550000003", first_guest.id)
        db.add(first_guest_conversation)
        db.flush()

        result = WhatsAppConversationRepository(db).get_or_create(
            hotel.id,
            "+15550000003",
            second_guest.id,
        )
        db.flush()

        assert result.id != first_guest_conversation.id
        assert result.guest_id == second_guest.id
        assert result.phone == "+15550000003"
    finally:
        db.rollback()
        db.close()

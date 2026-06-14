from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.whatsapp_session import WhatsAppSession
from app.repositories.base import BaseRepository


class WhatsAppSessionRepository(BaseRepository[WhatsAppSession]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppSession)

    def get_by_phone(self, hotel_id: str, phone: str) -> WhatsAppSession | None:
        return self.db.execute(
            select(WhatsAppSession).where(
                WhatsAppSession.hotel_id == hotel_id,
                WhatsAppSession.phone == phone,
            )
        ).scalar_one_or_none()

    def get_or_create(
        self,
        hotel_id: str,
        phone: str,
        phone_number_id: str | None,
    ) -> WhatsAppSession:
        session = self.get_by_phone(hotel_id, phone)
        if session:
            session.last_active_at = utcnow()
            return session

        session = WhatsAppSession(
            hotel_id=hotel_id,
            phone=phone,
            state="new",
            cart=[],
            pending_action=None,
            whatsapp_phone_number_id=phone_number_id,
            last_active_at=utcnow(),
        )
        self.db.add(session)
        self.db.flush()
        return session

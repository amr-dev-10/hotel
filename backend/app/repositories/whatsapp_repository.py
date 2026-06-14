from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.whatsapp import (
    WhatsAppAccount,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
)
from app.repositories.base import BaseRepository


class WhatsAppAccountRepository(BaseRepository[WhatsAppAccount]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppAccount)

    def get_by_phone_number_id(self, phone_number_id: str) -> WhatsAppAccount | None:
        return self.db.execute(
            select(WhatsAppAccount).where(
                WhatsAppAccount.phone_number_id == phone_number_id,
                WhatsAppAccount.status == "active",
            )
        ).scalar_one_or_none()


class WhatsAppTemplateRepository(BaseRepository[WhatsAppTemplate]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppTemplate)


class WhatsAppConversationRepository(BaseRepository[WhatsAppConversation]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppConversation)

    def get_or_create(
        self,
        hotel_id: str,
        phone: str,
        guest_id: str | None,
    ) -> WhatsAppConversation:
        statement = select(WhatsAppConversation).where(
            WhatsAppConversation.hotel_id == hotel_id,
            WhatsAppConversation.phone == phone,
        )
        conversation = self.db.execute(statement).scalar_one_or_none()
        if conversation:
            if guest_id and not conversation.guest_id:
                conversation.guest_id = guest_id
            conversation.last_message_at = utcnow()
            return conversation
        conversation = WhatsAppConversation(
            hotel_id=hotel_id,
            phone=phone,
            guest_id=guest_id,
            status="open",
            started_at=utcnow(),
            last_message_at=utcnow(),
        )
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def list_messages(self, hotel_id: str, conversation_id: str) -> Sequence[WhatsAppMessage]:
        return self.db.execute(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.hotel_id == hotel_id,
                WhatsAppMessage.conversation_id == conversation_id,
            )
            .order_by(WhatsAppMessage.created_at)
        ).scalars().all()

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.whatsapp import (
    LiveChatSession,
    WhatsAppAccount,
    WhatsAppAccountHealth,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
    WhatsAppUsage,
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

    def list_active(self) -> Sequence[WhatsAppAccount]:
        return self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.status == "active")
        ).scalars().all()


class WhatsAppTemplateRepository(BaseRepository[WhatsAppTemplate]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppTemplate)


class WhatsAppHealthRepository(BaseRepository[WhatsAppAccountHealth]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppAccountHealth)

    def get_for_account(
        self,
        hotel_id: str,
        account_id: str,
    ) -> WhatsAppAccountHealth | None:
        return self.db.execute(
            select(WhatsAppAccountHealth).where(
                WhatsAppAccountHealth.hotel_id == hotel_id,
                WhatsAppAccountHealth.whatsapp_account_id == account_id,
            )
        ).scalar_one_or_none()


class WhatsAppUsageRepository(BaseRepository[WhatsAppUsage]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppUsage)

    def get_for_month(self, hotel_id: str, year_month: str) -> WhatsAppUsage | None:
        return self.db.execute(
            select(WhatsAppUsage).where(
                WhatsAppUsage.hotel_id == hotel_id,
                WhatsAppUsage.year_month == year_month,
            )
        ).scalar_one_or_none()


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


class LiveChatSessionRepository(BaseRepository[LiveChatSession]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, LiveChatSession)

    def get_active_for_guest(self, hotel_id: str, guest_phone: str) -> LiveChatSession | None:
        return self.db.execute(
            select(LiveChatSession)
            .where(
                LiveChatSession.hotel_id == hotel_id,
                LiveChatSession.guest_phone == guest_phone,
                LiveChatSession.status.in_(("waiting", "active")),
            )
            .order_by(LiveChatSession.started_at.desc())
        ).scalars().first()

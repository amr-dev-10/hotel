from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.whatsapp import (
    LiveChatSession,
    ConversationWindow,
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

    def get_any_by_phone_number_id(self, phone_number_id: str) -> WhatsAppAccount | None:
        return self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.phone_number_id == phone_number_id)
        ).scalar_one_or_none()

    def list_active(self) -> Sequence[WhatsAppAccount]:
        return self.db.execute(
            select(WhatsAppAccount).where(WhatsAppAccount.status == "active")
        ).scalars().all()

    def first_active_for_hotel(self, hotel_id: str) -> WhatsAppAccount | None:
        return self.db.execute(
            select(WhatsAppAccount)
            .where(
                WhatsAppAccount.hotel_id == hotel_id,
                WhatsAppAccount.status == "active",
            )
            .order_by(WhatsAppAccount.created_at)
            .limit(1)
        ).scalars().first()


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
        whatsapp_account_id: str | None = None,
    ) -> WhatsAppConversation:
        now = utcnow()
        if guest_id:
            conversation = self.db.execute(
                select(WhatsAppConversation).where(
                    WhatsAppConversation.hotel_id == hotel_id,
                    WhatsAppConversation.guest_id == guest_id,
                )
            ).scalar_one_or_none()
            if conversation:
                conversation.phone = phone
                if whatsapp_account_id and not conversation.whatsapp_account_id:
                    conversation.whatsapp_account_id = whatsapp_account_id
                conversation.last_message_at = now
                return conversation

        statement = select(WhatsAppConversation).where(
            WhatsAppConversation.hotel_id == hotel_id,
            WhatsAppConversation.phone == phone,
        )
        if whatsapp_account_id:
            statement = statement.where(
                or_(
                    WhatsAppConversation.whatsapp_account_id == whatsapp_account_id,
                    WhatsAppConversation.whatsapp_account_id.is_(None),
                )
            )
        order_by = [
            WhatsAppConversation.guest_id.is_not(None),
            WhatsAppConversation.last_message_at.desc(),
            WhatsAppConversation.started_at.desc(),
        ]
        if whatsapp_account_id:
            order_by.insert(0, WhatsAppConversation.whatsapp_account_id.is_(None))
        conversation = self.db.execute(
            statement.order_by(*order_by)
        ).scalars().first()
        if (
            conversation
            and guest_id
            and conversation.guest_id
            and conversation.guest_id != guest_id
        ):
            conversation = None
        if conversation:
            if guest_id and not conversation.guest_id:
                conversation.guest_id = guest_id
            if whatsapp_account_id and not conversation.whatsapp_account_id:
                conversation.whatsapp_account_id = whatsapp_account_id
            conversation.last_message_at = now
            return conversation
        conversation = WhatsAppConversation(
            hotel_id=hotel_id,
            whatsapp_account_id=whatsapp_account_id,
            phone=phone,
            guest_id=guest_id,
            status="open",
            started_at=now,
            last_message_at=now,
        )
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def list_messages(
        self,
        hotel_id: str,
        conversation_id: str,
        ticket_id: str | None = None,
    ) -> Sequence[WhatsAppMessage]:
        statement = select(WhatsAppMessage).where(
            WhatsAppMessage.hotel_id == hotel_id,
            WhatsAppMessage.conversation_id == conversation_id,
        )
        if ticket_id:
            statement = statement.where(WhatsAppMessage.ticket_id == ticket_id)
        return self.db.execute(statement.order_by(WhatsAppMessage.created_at)).scalars().all()

    def list_for_hotel(
        self,
        hotel_id: str,
        limit: int = 50,
        cursor: str | None = None,
    ) -> Sequence[WhatsAppConversation]:
        statement = select(WhatsAppConversation).where(
            WhatsAppConversation.hotel_id == hotel_id,
            WhatsAppConversation.status != "deleted",
        )
        if cursor:
            statement = statement.where(WhatsAppConversation.id > cursor)
        return self.db.execute(
            statement.order_by(
                WhatsAppConversation.last_message_at.desc().nullslast(),
                WhatsAppConversation.started_at.desc(),
            ).limit(limit)
        ).scalars().all()

    def list_ticket_messages(self, hotel_id: str, ticket_id: str) -> Sequence[WhatsAppMessage]:
        return self.db.execute(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.hotel_id == hotel_id,
                WhatsAppMessage.ticket_id == ticket_id,
            )
            .order_by(WhatsAppMessage.created_at)
        ).scalars().all()


class WhatsAppMessageRepository(BaseRepository[WhatsAppMessage]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WhatsAppMessage)

    def get_by_meta_message_id(
        self,
        hotel_id: str,
        meta_message_id: str,
    ) -> WhatsAppMessage | None:
        return self.db.execute(
            select(WhatsAppMessage).where(
                WhatsAppMessage.hotel_id == hotel_id,
                WhatsAppMessage.meta_message_id == meta_message_id,
            )
        ).scalar_one_or_none()

    def update_status_by_meta_message_id(
        self,
        hotel_id: str,
        meta_message_id: str,
        status: str,
    ) -> WhatsAppMessage | None:
        message = self.get_by_meta_message_id(hotel_id, meta_message_id)
        if not message:
            return None
        message.status = status
        return message


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


class ConversationWindowRepository(BaseRepository[ConversationWindow]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ConversationWindow)

    def get_open(
        self,
        hotel_id: str,
        guest_phone: str,
        category: str,
        now,
    ) -> ConversationWindow | None:
        return self.db.execute(
            select(ConversationWindow)
            .where(
                ConversationWindow.hotel_id == hotel_id,
                ConversationWindow.guest_phone == guest_phone,
                ConversationWindow.category == category,
                ConversationWindow.closes_at > now,
            )
            .order_by(ConversationWindow.opened_at.desc())
        ).scalars().first()

    def list_for_month(self, hotel_id: str, year_month: str) -> Sequence[ConversationWindow]:
        start = datetime.strptime(f"{year_month}-01", "%Y-%m-%d").replace(tzinfo=UTC)
        if start.month == 12:
            end = start.replace(year=start.year + 1, month=1)
        else:
            end = start.replace(month=start.month + 1)
        return self.db.execute(
            select(ConversationWindow).where(
                ConversationWindow.hotel_id == hotel_id,
                ConversationWindow.opened_at >= start,
                ConversationWindow.opened_at < end,
            )
        ).scalars().all()

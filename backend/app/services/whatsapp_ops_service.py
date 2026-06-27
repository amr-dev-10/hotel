from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.whatsapp import ConversationWindow, LiveChatSession, WhatsAppAccountHealth, WhatsAppUsage
from app.repositories.guest_repository import GuestRepository
from app.repositories.user_repository import UserRepository
from app.repositories.whatsapp_repository import (
    LiveChatSessionRepository,
    WhatsAppAccountRepository,
    WhatsAppConversationRepository,
    ConversationWindowRepository,
    WhatsAppHealthRepository,
    WhatsAppUsageRepository,
)
from app.schemas.ops import NotificationCreate
from app.services.ops_service import NotificationCenterService


class WhatsAppUsageService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.usage = WhatsAppUsageRepository(db)

    def get_or_create(self, hotel_id: str, year_month: str | None = None) -> WhatsAppUsage:
        year_month = year_month or utcnow().strftime("%Y-%m")
        usage = self.usage.get_for_month(hotel_id, year_month)
        if not usage:
            usage = WhatsAppUsage(hotel_id=hotel_id, year_month=year_month, updated_at=utcnow())
            self.db.add(usage)
            self.db.flush()
        return usage

    def increment(self, hotel_id: str, field: str, amount: int = 1, commit: bool = False) -> WhatsAppUsage:
        usage = self.get_or_create(hotel_id)
        current = getattr(usage, field)
        setattr(usage, field, current + amount)
        usage.updated_at = utcnow()
        if commit:
            self.db.commit()
            self.db.refresh(usage)
        return usage


class ConversationWindowService:
    CATEGORY_COST = {
        "service": Decimal("0.0040"),
        "marketing": Decimal("0.0090"),
        "utility": Decimal("0.0050"),
        "authentication": Decimal("0.0040"),
    }

    def __init__(self, db: Session) -> None:
        self.db = db
        self.windows = ConversationWindowRepository(db)

    def track_message(
        self,
        hotel_id: str,
        guest_phone: str,
        category: str = "service",
        meta_conversation_id: str | None = None,
        commit: bool = False,
    ) -> ConversationWindow:
        now = utcnow()
        window = self.windows.get_open(hotel_id, guest_phone, category, now)
        if not window:
            window = ConversationWindow(
                hotel_id=hotel_id,
                guest_phone=guest_phone,
                category=category,
                opened_at=now,
                closes_at=now + timedelta(hours=24),
                message_count=0,
                estimated_cost=self.CATEGORY_COST.get(category, self.CATEGORY_COST["service"]),
                meta_conversation_id=meta_conversation_id,
            )
            self.db.add(window)
            self.db.flush()
        window.message_count += 1
        if meta_conversation_id and not window.meta_conversation_id:
            window.meta_conversation_id = meta_conversation_id
        if commit:
            self.db.commit()
            self.db.refresh(window)
        return window

    def list_for_month(self, hotel_id: str, year_month: str | None = None) -> list[ConversationWindow]:
        return list(self.windows.list_for_month(hotel_id, year_month or utcnow().strftime("%Y-%m")))

    def summary(self, hotel_id: str, year_month: str | None = None) -> dict:
        rows = self.list_for_month(hotel_id, year_month)
        by_category: dict[str, dict[str, int | float]] = {}
        for row in rows:
            bucket = by_category.setdefault(row.category, {"windows": 0, "messages": 0, "estimated_cost": 0.0})
            bucket["windows"] = int(bucket["windows"]) + 1
            bucket["messages"] = int(bucket["messages"]) + row.message_count
            bucket["estimated_cost"] = float(bucket["estimated_cost"]) + float(row.estimated_cost)
        return {
            "year_month": year_month or utcnow().strftime("%Y-%m"),
            "total_windows": len(rows),
            "total_messages": sum(row.message_count for row in rows),
            "estimated_cost": sum(float(row.estimated_cost) for row in rows),
            "by_category": by_category,
        }


class WhatsAppHealthService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.accounts = WhatsAppAccountRepository(db)
        self.health = WhatsAppHealthRepository(db)

    def get_or_create(self, hotel_id: str, account_id: str) -> WhatsAppAccountHealth:
        record = self.health.get_for_account(hotel_id, account_id)
        if not record:
            record = WhatsAppAccountHealth(
                hotel_id=hotel_id,
                whatsapp_account_id=account_id,
                token_status="valid",
                webhook_status="active",
            )
            self.db.add(record)
            self.db.flush()
        return record

    def record_webhook(self, hotel_id: str, account_id: str, commit: bool = False) -> WhatsAppAccountHealth:
        health = self.get_or_create(hotel_id, account_id)
        health.last_webhook_received_at = utcnow()
        health.last_message_received_at = utcnow()
        health.webhook_status = "active"
        health.checked_at = utcnow()
        if commit:
            self.db.commit()
            self.db.refresh(health)
        return health

    def record_sent(self, hotel_id: str, account_id: str, commit: bool = False) -> WhatsAppAccountHealth:
        health = self.get_or_create(hotel_id, account_id)
        health.last_message_sent_at = utcnow()
        health.checked_at = utcnow()
        if commit:
            self.db.commit()
            self.db.refresh(health)
        return health

    def check_account(self, hotel_id: str, account_id: str) -> WhatsAppAccountHealth:
        account = self.accounts.get_for_hotel(hotel_id, account_id)
        if not account:
            raise not_found("WhatsApp account not found")
        health = self.get_or_create(hotel_id, account.id)
        now = utcnow()
        last_webhook = self._aware(health.last_webhook_received_at)
        token_expires_at = self._aware(account.token_expires_at)
        if last_webhook and last_webhook < now - timedelta(minutes=30):
            health.webhook_status = "stale"
        if token_expires_at and token_expires_at < now + timedelta(days=7):
            health.token_status = "expiring_soon"
        if token_expires_at and token_expires_at < now:
            health.token_status = "expired"
        if health.error_count_24h > 50:
            health.webhook_status = "degraded"
        health.checked_at = now
        self.db.commit()
        self.db.refresh(health)
        return health

    def _aware(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=UTC)
        return value


class LiveChatService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.sessions = LiveChatSessionRepository(db)
        self.users = UserRepository(db)
        self.guests = GuestRepository(db)
        self.conversations = WhatsAppConversationRepository(db)

    def start(
        self,
        hotel_id: str,
        guest_phone: str,
        guest_id: str | None,
        commit: bool = False,
    ) -> LiveChatSession:
        existing = self.sessions.get_active_for_guest(hotel_id, guest_phone)
        if existing:
            return existing
        chat = LiveChatSession(
            hotel_id=hotel_id,
            guest_id=guest_id,
            guest_phone=guest_phone,
            status="waiting",
            started_at=utcnow(),
        )
        self.db.add(chat)
        self.db.flush()
        NotificationCenterService(self.db).create(
            hotel_id,
            NotificationCreate(
                channel="websocket",
                title="Live chat waiting",
                message=f"Guest {guest_phone} wants to talk to staff.",
                metadata={"live_chat_session_id": chat.id},
            ),
            commit=False,
        )
        if commit:
            self.db.commit()
            self.db.refresh(chat)
        return chat

    def accept(self, hotel_id: str, session_id: str, staff_id: str) -> LiveChatSession:
        chat = self.sessions.get_for_hotel(hotel_id, session_id)
        if not chat:
            raise not_found("Live chat session not found")
        chat.status = "active"
        chat.assigned_staff_id = staff_id
        self.db.commit()
        self.db.refresh(chat)
        return chat

    def end(self, hotel_id: str, session_id: str, ended_by: str) -> LiveChatSession:
        chat = self.sessions.get_for_hotel(hotel_id, session_id)
        if not chat:
            raise not_found("Live chat session not found")
        chat.status = "ended"
        chat.ended_at = utcnow()
        chat.ended_by = ended_by
        self.db.commit()
        self.db.refresh(chat)
        return chat

    def send_staff_message(
        self,
        hotel_id: str,
        session_id: str,
        message: str,
        staff_id: str,
    ) -> dict:
        chat = self.sessions.get_for_hotel(hotel_id, session_id)
        if not chat:
            raise not_found("Live chat session not found")
        if chat.status == "waiting":
            chat.status = "active"
            chat.assigned_staff_id = staff_id
        account = WhatsAppAccountRepository(self.db).first_active_for_hotel(hotel_id)
        conversation = self.conversations.get_or_create(
            hotel_id,
            chat.guest_phone,
            chat.guest_id,
            account.id if account else None,
        )
        from app.models.whatsapp import WhatsAppMessage

        self.db.add(
            WhatsAppMessage(
                hotel_id=hotel_id,
                whatsapp_account_id=account.id if account else None,
                conversation_id=conversation.id,
                ticket_id=None,
                direction="outbound",
                message_type="text",
                message_text=message,
                status="sent",
                created_at=utcnow(),
            )
        )
        ConversationWindowService(self.db).track_message(
            hotel_id,
            chat.guest_phone,
            category="service",
            commit=False,
        )
        self.db.commit()
        return {"sent": True, "dry_run": True, "guest_phone": chat.guest_phone}

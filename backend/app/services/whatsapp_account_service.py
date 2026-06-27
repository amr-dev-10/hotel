from sqlalchemy.orm import Session

from app.core.encryption import decrypt_secret, encrypt_secret
from app.core.vault import Vault
from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.whatsapp import WhatsAppAccount, WhatsAppTemplate
from app.repositories.ticket_repository import TicketRepository
from app.repositories.whatsapp_repository import WhatsAppAccountRepository, WhatsAppTemplateRepository, WhatsAppConversationRepository
from app.schemas.whatsapp_account import (
    WhatsAppAccountCreate,
    WhatsAppOnboardingStart,
    WhatsAppOnboardingVerify,
    WhatsAppTemplateCreate,
    WhatsAppTestMessageRequest,
    WhatsAppMessageSendRequest,
)
from app.services.audit_service import AuditService
from app.services.whatsapp_contact_sync import sync_guest_whatsapp_contact
from app.services.whatsapp_ops_service import ConversationWindowService, WhatsAppHealthService
from app.services.whatsapp_service import WhatsAppService


class WhatsAppAccountService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.accounts = WhatsAppAccountRepository(db)

    def create_account(
        self,
        hotel_id: str,
        payload: WhatsAppAccountCreate,
        actor_id: str | None,
    ) -> WhatsAppAccount:
        if self.accounts.get_by_phone_number_id(payload.phone_number_id):
            raise bad_request("WhatsApp phone_number_id is already mapped")
        data = payload.model_dump()
        access_token = data.pop("access_token", None)
        if access_token:
            data["access_token_encrypted"] = encrypt_secret(access_token)
        account = WhatsAppAccount(hotel_id=hotel_id, **data)
        self.db.add(account)
        self.db.flush()
        if access_token:
            Vault(self.db).store(
                hotel_id,
                f"whatsapp_token:{account.phone_number_id}",
                access_token,
                commit=False,
            )
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.account.created",
            "whatsapp_account",
            account.id,
            actor_id,
        )
        self.db.commit()
        self.db.refresh(account)
        return account

    def start_onboarding(
        self,
        hotel_id: str,
        payload: WhatsAppOnboardingStart,
        actor_id: str | None,
    ) -> WhatsAppAccount:
        account = self.accounts.get_any_by_phone_number_id(payload.phone_number_id)
        if account and account.hotel_id != hotel_id:
            raise bad_request("WhatsApp phone_number_id is already mapped")
        if not account:
            account = WhatsAppAccount(
                hotel_id=hotel_id,
                business_name=payload.business_name,
                phone_number=payload.phone_number,
                phone_number_id=payload.phone_number_id,
                waba_id=payload.waba_id,
                status="pending",
                onboarding_step="token_required",
            )
            self.db.add(account)
            self.db.flush()
        else:
            account.business_name = payload.business_name
            account.phone_number = payload.phone_number
            account.waba_id = payload.waba_id
            account.status = "pending"
            account.onboarding_step = "token_required"
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.onboarding.started",
            "whatsapp_account",
            account.id,
            actor_id,
        )
        self.db.commit()
        self.db.refresh(account)
        return account

    def verify_onboarding(
        self,
        hotel_id: str,
        account_id: str,
        payload: WhatsAppOnboardingVerify,
        actor_id: str | None,
    ) -> WhatsAppAccount:
        account = self.accounts.get_for_hotel(hotel_id, account_id)
        if not account:
            raise not_found("WhatsApp account not found")
        account.access_token = None
        account.access_token_encrypted = encrypt_secret(payload.access_token)
        account.token_expires_at = payload.token_expires_at
        account.status = "active"
        account.onboarding_step = "test_message"
        account.connected_at = account.connected_at or utcnow()
        account.last_verified_at = utcnow()
        Vault(self.db).store(
            hotel_id,
            f"whatsapp_token:{account.phone_number_id}",
            payload.access_token,
            commit=False,
        )
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.onboarding.verified",
            "whatsapp_account",
            account.id,
            actor_id,
        )
        self.db.commit()
        self.db.refresh(account)
        return account

    def send_test_message(
        self,
        hotel_id: str,
        account_id: str,
        payload: WhatsAppTestMessageRequest,
        actor_id: str | None,
    ) -> dict:
        account = self.accounts.get_for_hotel(hotel_id, account_id)
        if not account:
            raise not_found("WhatsApp account not found")
        access_token = self._access_token(account)
        result = WhatsAppService().send_text(
            account.phone_number_id,
            payload.to_phone,
            payload.message,
            access_token=access_token,
        )
        account.status = "active"
        account.onboarding_step = "complete"
        account.connected_at = account.connected_at or utcnow()
        account.last_verified_at = utcnow()
        WhatsAppHealthService(self.db).record_sent(hotel_id, account.id, commit=False)
        ConversationWindowService(self.db).track_message(
            hotel_id,
            payload.to_phone,
            category="service",
            commit=False,
        )
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.onboarding.test_message",
            "whatsapp_account",
            account.id,
            actor_id,
            {"to_phone": payload.to_phone},
        )
        self.db.commit()
        self.db.refresh(account)
        return {"account": account, "send_result": result}

    def send_conversation_message(
        self,
        hotel_id: str,
        conversation_id: str,
        message: str,
        actor_id: str | None,
        reservation_id: str | None = None,
        ticket_id: str | None = None,
    ) -> dict:
        conversation = WhatsAppConversationRepository(self.db).get_for_hotel(hotel_id, conversation_id)
        if not conversation:
            raise not_found("Conversation not found")
        if ticket_id:
            ticket = TicketRepository(self.db).get_for_hotel(hotel_id, ticket_id)
            if not ticket:
                raise not_found("Ticket not found")
            if ticket.conversation_id and ticket.conversation_id != conversation_id:
                raise bad_request("Ticket is linked to another WhatsApp conversation")
        if conversation.guest_id:
            from app.models.guest import Guest

            guest = self.db.get(Guest, conversation.guest_id)
            if guest and guest.hotel_id == hotel_id:
                sync_guest_whatsapp_contact(self.db, guest)
                self.db.flush()
            
        account = self.accounts.first_active_for_hotel(hotel_id)
        if not account:
            raise bad_request("WhatsApp account not configured")

        access_token = self._access_token(account)
        result = WhatsAppService().send_text(
            account.phone_number_id,
            conversation.phone,
            message,
            access_token=access_token,
        )
        if not conversation.whatsapp_account_id:
            conversation.whatsapp_account_id = account.id
        
        from app.models.whatsapp import WhatsAppMessage
        msg = WhatsAppMessage(
            hotel_id=hotel_id,
            whatsapp_account_id=account.id,
            conversation_id=conversation.id,
            reservation_id=reservation_id,
            ticket_id=ticket_id,
            direction="outbound",
            message_type="text",
            message_text=message,
            meta_message_id=self._meta_message_id_from_send_result(result),
            status="sent",
            created_at=utcnow(),
        )
        self.db.add(msg)
        conversation.last_message_at = utcnow()
        
        WhatsAppHealthService(self.db).record_sent(hotel_id, account.id, commit=False)
        ConversationWindowService(self.db).track_message(
            hotel_id,
            conversation.phone,
            category="service",
            commit=False,
        )
        
        self.db.commit()
        return {"sent": True, "result": result}

    def update_account(
        self,
        hotel_id: str,
        account_id: str,
        payload: WhatsAppAccountCreate,
        actor_id: str | None,
    ) -> WhatsAppAccount:
        account = self.accounts.get_for_hotel(hotel_id, account_id)
        if not account:
            raise bad_request("WhatsApp account not found")
        data = payload.model_dump()
        access_token = data.pop("access_token", None)
        if access_token:
            data["access_token_encrypted"] = encrypt_secret(access_token)
            account.access_token = None
        for key, value in data.items():
            setattr(account, key, value)
        if access_token:
            Vault(self.db).store(
                hotel_id,
                f"whatsapp_token:{account.phone_number_id}",
                access_token,
                commit=False,
            )
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.account.updated",
            "whatsapp_account",
            account.id,
            actor_id,
        )
        self.db.commit()
        self.db.refresh(account)
        return account

    def _access_token(self, account: WhatsAppAccount) -> str | None:
        if account.access_token_encrypted:
            return decrypt_secret(account.access_token_encrypted)
        return account.access_token

    def _meta_message_id_from_send_result(self, send_result: dict) -> str | None:
        sent_messages = send_result.get("messages")
        if not isinstance(sent_messages, list) or not sent_messages:
            return None
        first = sent_messages[0]
        if not isinstance(first, dict):
            return None
        message_id = first.get("id")
        return message_id if isinstance(message_id, str) else None


class WhatsAppTemplateService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.templates = WhatsAppTemplateRepository(db)

    def create_template(
        self,
        hotel_id: str,
        payload: WhatsAppTemplateCreate,
        actor_id: str | None,
    ) -> WhatsAppTemplate:
        template = WhatsAppTemplate(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(template)
        self.db.flush()
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.template.created",
            "whatsapp_template",
            template.id,
            actor_id,
        )
        self.db.commit()
        self.db.refresh(template)
        return template

    def sync_templates(self, hotel_id: str, actor_id: str | None) -> dict:
        AuditService(self.db).log(
            hotel_id,
            "whatsapp.templates.synced",
            "whatsapp_template",
            None,
            actor_id,
            {"dry_run": True},
            commit=True,
        )
        return {"synced": True, "dry_run": True}

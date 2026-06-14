from sqlalchemy.orm import Session

from app.core.encryption import encrypt_secret
from app.core.exceptions import bad_request
from app.models.whatsapp import WhatsAppAccount, WhatsAppTemplate
from app.repositories.whatsapp_repository import WhatsAppAccountRepository, WhatsAppTemplateRepository
from app.schemas.whatsapp_account import WhatsAppAccountCreate, WhatsAppTemplateCreate
from app.services.audit_service import AuditService


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
        if data.get("access_token") and not data.get("access_token_encrypted"):
            data["access_token_encrypted"] = encrypt_secret(data["access_token"])
        account = WhatsAppAccount(hotel_id=hotel_id, **data)
        self.db.add(account)
        self.db.flush()
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
        if data.get("access_token") and not data.get("access_token_encrypted"):
            data["access_token_encrypted"] = encrypt_secret(data["access_token"])
        for key, value in data.items():
            setattr(account, key, value)
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

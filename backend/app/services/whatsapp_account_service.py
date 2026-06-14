from sqlalchemy.orm import Session

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
        account = WhatsAppAccount(hotel_id=hotel_id, **payload.model_dump())
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

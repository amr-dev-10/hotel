from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.whatsapp_repository import (
    WhatsAppAccountRepository,
    WhatsAppConversationRepository,
    WhatsAppTemplateRepository,
)
from app.schemas.whatsapp_account import (
    WhatsAppAccountCreate,
    WhatsAppAccountRead,
    WhatsAppConversationRead,
    WhatsAppHealthRead,
    WhatsAppMessageRead,
    WhatsAppTemplateCreate,
    WhatsAppTemplateRead,
    WhatsAppUsageRead,
)
from app.services.whatsapp_account_service import WhatsAppAccountService, WhatsAppTemplateService
from app.services.whatsapp_ops_service import WhatsAppHealthService, WhatsAppUsageService

router = APIRouter()


@router.get("/accounts")
def list_accounts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    accounts = WhatsAppAccountRepository(db).list_for_hotel(hotel_id)
    return ok([WhatsAppAccountRead.model_validate(item).model_dump() for item in accounts])


@router.get("/account")
def get_account(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    accounts = WhatsAppAccountRepository(db).list_for_hotel(hotel_id, limit=1)
    account = accounts[0] if accounts else None
    return ok(WhatsAppAccountRead.model_validate(account).model_dump() if account else None)


@router.post("/accounts")
def create_account(
    hotel_id: str,
    payload: WhatsAppAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    account = WhatsAppAccountService(db).create_account(hotel_id, payload, current_user.id)
    return ok(WhatsAppAccountRead.model_validate(account).model_dump())


@router.put("/account")
def upsert_account(
    hotel_id: str,
    payload: WhatsAppAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    repo = WhatsAppAccountRepository(db)
    accounts = repo.list_for_hotel(hotel_id, limit=1)
    service = WhatsAppAccountService(db)
    if accounts:
        account = service.update_account(hotel_id, accounts[0].id, payload, current_user.id)
    else:
        account = service.create_account(hotel_id, payload, current_user.id)
    return ok(WhatsAppAccountRead.model_validate(account).model_dump())


@router.get("/templates")
def list_templates(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.view")),
) -> dict:
    templates = WhatsAppTemplateRepository(db).list_for_hotel(hotel_id)
    return ok([WhatsAppTemplateRead.model_validate(item).model_dump() for item in templates])


@router.post("/templates")
def create_template(
    hotel_id: str,
    payload: WhatsAppTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.create")),
) -> dict:
    template = WhatsAppTemplateService(db).create_template(hotel_id, payload, current_user.id)
    return ok(WhatsAppTemplateRead.model_validate(template).model_dump())


@router.post("/templates/sync")
def sync_templates(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.create")),
) -> dict:
    return ok(WhatsAppTemplateService(db).sync_templates(hotel_id, current_user.id))


@router.get("/conversations/{conversation_id}/messages")
def list_conversation_messages(
    hotel_id: str,
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    messages = WhatsAppConversationRepository(db).list_messages(hotel_id, conversation_id)
    return ok([WhatsAppMessageRead.model_validate(item).model_dump() for item in messages])


@router.get("/conversations")
def list_conversations(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    conversations = WhatsAppConversationRepository(db).list_for_hotel(hotel_id)
    return ok([WhatsAppConversationRead.model_validate(item).model_dump() for item in conversations])


@router.get("/health")
def whatsapp_health(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    accounts = WhatsAppAccountRepository(db).list_for_hotel(hotel_id)
    service = WhatsAppHealthService(db)
    health_rows = [service.check_account(hotel_id, account.id) for account in accounts]
    return ok([WhatsAppHealthRead.model_validate(item).model_dump() for item in health_rows])


@router.get("/usage")
def whatsapp_usage(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.billing.view")),
) -> dict:
    usage = WhatsAppUsageService(db).get_or_create(hotel_id)
    db.commit()
    db.refresh(usage)
    return ok(WhatsAppUsageRead.model_validate(usage).model_dump())

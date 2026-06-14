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
    WhatsAppMessageRead,
    WhatsAppTemplateCreate,
    WhatsAppTemplateRead,
)
from app.services.whatsapp_account_service import WhatsAppAccountService, WhatsAppTemplateService

router = APIRouter()


@router.get("/accounts")
def list_accounts(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    accounts = WhatsAppAccountRepository(db).list_for_hotel(hotel_id)
    return ok([WhatsAppAccountRead.model_validate(item).model_dump() for item in accounts])


@router.post("/accounts")
def create_account(
    hotel_id: str,
    payload: WhatsAppAccountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    account = WhatsAppAccountService(db).create_account(hotel_id, payload, current_user.id)
    return ok(WhatsAppAccountRead.model_validate(account).model_dump())


@router.get("/templates")
def list_templates(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.create")),
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


@router.get("/conversations/{conversation_id}/messages")
def list_conversation_messages(
    hotel_id: str,
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    messages = WhatsAppConversationRepository(db).list_messages(hotel_id, conversation_id)
    return ok([WhatsAppMessageRead.model_validate(item).model_dump() for item in messages])


@router.get("/conversations")
def list_conversations(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    conversations = WhatsAppConversationRepository(db).list_for_hotel(hotel_id)
    return ok([WhatsAppConversationRead.model_validate(item).model_dump() for item in conversations])

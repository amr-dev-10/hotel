from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import not_found
from app.core.responses import ok
from app.models.base import utcnow
from app.models.user import User
from app.models.whatsapp_session import WhatsAppSession
from app.repositories.whatsapp_repository import (
    ConversationWindowRepository,
    WhatsAppAccountRepository,
    WhatsAppConversationRepository,
    WhatsAppTemplateRepository,
)
from app.schemas.whatsapp_account import (
    ConversationWindowRead,
    WhatsAppAccountCreate,
    WhatsAppAccountRead,
    WhatsAppConversationRead,
    WhatsAppConversationUpdateRequest,
    WhatsAppHealthRead,
    WhatsAppMessageRead,
    WhatsAppMessageSendRequest,
    WhatsAppOnboardingStart,
    WhatsAppOnboardingVerify,
    WhatsAppTemplateCreate,
    WhatsAppTemplateRead,
    WhatsAppTestMessageRequest,
    WhatsAppUsageRead,
)
from app.services.whatsapp_account_service import WhatsAppAccountService, WhatsAppTemplateService
from app.services.whatsapp_ops_service import (
    ConversationWindowService,
    WhatsAppHealthService,
    WhatsAppUsageService,
)

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


@router.post("/onboarding/start")
def start_onboarding(
    hotel_id: str,
    payload: WhatsAppOnboardingStart,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    account = WhatsAppAccountService(db).start_onboarding(hotel_id, payload, current_user.id)
    return ok(WhatsAppAccountRead.model_validate(account).model_dump())


@router.post("/accounts/{account_id}/onboarding/verify")
def verify_onboarding(
    hotel_id: str,
    account_id: str,
    payload: WhatsAppOnboardingVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    account = WhatsAppAccountService(db).verify_onboarding(hotel_id, account_id, payload, current_user.id)
    return ok(WhatsAppAccountRead.model_validate(account).model_dump())


@router.post("/accounts/{account_id}/test-message")
def send_test_message(
    hotel_id: str,
    account_id: str,
    payload: WhatsAppTestMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    result = WhatsAppAccountService(db).send_test_message(hotel_id, account_id, payload, current_user.id)
    account = result["account"]
    return ok(
        {
            "account": WhatsAppAccountRead.model_validate(account).model_dump(),
            "send_result": result["send_result"],
        }
    )


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
    ticket_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    messages = WhatsAppConversationRepository(db).list_messages(hotel_id, conversation_id, ticket_id=ticket_id)
    return ok([WhatsAppMessageRead.model_validate(item).model_dump() for item in messages])


@router.post("/conversations/{conversation_id}/messages")
def send_conversation_message(
    hotel_id: str,
    conversation_id: str,
    payload: WhatsAppMessageSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    result = WhatsAppAccountService(db).send_conversation_message(
        hotel_id,
        conversation_id,
        payload.message,
        current_user.id,
        reservation_id=payload.reservation_id,
        ticket_id=payload.ticket_id,
    )
    return ok(result)


@router.get("/conversations")
def list_conversations(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    conversations = WhatsAppConversationRepository(db).list_for_hotel(hotel_id)
    return ok([WhatsAppConversationRead.model_validate(item).model_dump() for item in conversations])


@router.patch("/conversations/{conversation_id}")
def update_conversation(
    hotel_id: str,
    conversation_id: str,
    payload: WhatsAppConversationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    repo = WhatsAppConversationRepository(db)
    conversation = repo.get(conversation_id)
    if not conversation or conversation.hotel_id != hotel_id:
        return {"error": "Not found"}

    if payload.status:
        conversation.status = payload.status
        if payload.status == "resolved":
            conversation.resolved_at = utcnow()
            conversation.resolved_by = current_user.id
        elif payload.status == "open":
            conversation.resolved_at = None
            conversation.resolved_by = None
    
    if payload.priority:
        conversation.priority = payload.priority
        
    if payload.assigned_staff_id is not None:
        if payload.assigned_staff_id != conversation.assigned_staff_id:
            conversation.assigned_staff_id = payload.assigned_staff_id
            conversation.assigned_at = utcnow() if payload.assigned_staff_id else None

    db.commit()
    db.refresh(conversation)
    return ok(WhatsAppConversationRead.model_validate(conversation).model_dump())


@router.delete("/conversations/{conversation_id}/profile")
def delete_conversation_profile(
    hotel_id: str,
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    repo = WhatsAppConversationRepository(db)
    conversation = repo.get_for_hotel(hotel_id, conversation_id)
    if not conversation:
        raise not_found("Conversation not found")

    previous_guest_id = conversation.guest_id
    conversation.guest_id = None

    if previous_guest_id:
        sessions = db.execute(
            select(WhatsAppSession).where(
                WhatsAppSession.hotel_id == hotel_id,
                WhatsAppSession.phone == conversation.phone,
                WhatsAppSession.guest_id == previous_guest_id,
            )
        ).scalars().all()
        for session in sessions:
            session.guest_id = None
            session.room_id = None
            session.state = "new"
            session.pending_action = None
            session.form_responses = {}

    db.commit()
    db.refresh(conversation)
    return ok(WhatsAppConversationRead.model_validate(conversation).model_dump())



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


@router.get("/conversation-windows")
def list_conversation_windows(
    hotel_id: str,
    year_month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.billing.view")),
) -> dict:
    windows = ConversationWindowService(db).list_for_month(hotel_id, year_month)
    return ok([ConversationWindowRead.model_validate(item).model_dump() for item in windows])


@router.get("/conversation-windows/summary")
def conversation_window_summary(
    hotel_id: str,
    year_month: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.billing.view")),
) -> dict:
    return ok(ConversationWindowService(db).summary(hotel_id, year_month))

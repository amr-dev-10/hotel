from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.guest_dependencies import require_guest_session
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.schemas.guest_portal import (
    GuestChatConversationRead,
    GuestChatSendRequest,
)
from app.services.guest_portal_chat_service import GuestPortalChatService
from app.services.guest_portal_service import GuestPortalContext

router = APIRouter()


@router.get("/chat/conversation")
def get_chat_conversation(
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    conversation = GuestPortalChatService(db).get_or_create_conversation(context)
    db.commit()
    db.refresh(conversation)
    return ok(
        GuestChatConversationRead(
            id=conversation.id,
            status=conversation.status,
            last_message_at=conversation.last_message_at,
        ).model_dump()
    )


@router.get("/chat/messages")
def list_chat_messages(
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    service = GuestPortalChatService(db)
    messages = service.list_messages(context, limit=limit)
    db.commit()
    return ok([service.message_read(message).model_dump() for message in messages])


@router.post("/chat/send")
async def send_chat_message(
    payload: GuestChatSendRequest,
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    message = payload.message.strip()
    if not message:
        raise bad_request("Message cannot be empty")
    response = await GuestPortalChatService(db).send_message(context, message)
    return ok(response.model_dump())

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.whatsapp_repository import LiveChatSessionRepository
from app.schemas.whatsapp_account import LiveChatSendRequest, LiveChatSessionRead
from app.services.whatsapp_ops_service import LiveChatService

router = APIRouter()


@router.get("/sessions")
def list_live_chat_sessions(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    sessions = LiveChatSessionRepository(db).list_for_hotel(hotel_id)
    return ok([LiveChatSessionRead.model_validate(item).model_dump() for item in sessions])


@router.post("/{session_id}/accept")
def accept_live_chat(
    hotel_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    session = LiveChatService(db).accept(hotel_id, session_id, current_user.id)
    return ok(LiveChatSessionRead.model_validate(session).model_dump())


@router.post("/{session_id}/end")
def end_live_chat(
    hotel_id: str,
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    session = LiveChatService(db).end(hotel_id, session_id, "staff")
    return ok(LiveChatSessionRead.model_validate(session).model_dump())


@router.post("/{session_id}/send")
def send_live_chat_message(
    hotel_id: str,
    session_id: str,
    payload: LiveChatSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    return ok(LiveChatService(db).send_staff_message(hotel_id, session_id, payload.message, current_user.id))

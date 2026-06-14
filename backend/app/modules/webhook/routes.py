from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_hmac_sha256_signature
from app.database.session import get_db
from app.modules.tenant.models import Tenant
from app.services.ticket_service import publish_ticket_event
from app.services.whatsapp_flow import WhatsAppFlowService
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/webhook", tags=["webhooks"])


@router.get("/whatsapp")
def verify_whatsapp_webhook(
    mode: str = Query(alias="hub.mode"),
    verify_token: str = Query(alias="hub.verify_token"),
    challenge: str = Query(alias="hub.challenge"),
) -> Response:
    if mode == "subscribe" and verify_token == settings.whatsapp_verify_token:
        return Response(content=challenge, media_type="text/plain")
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Webhook verification failed")


def _extract_message(payload: dict[str, Any]) -> dict[str, str | None] | None:
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages") or []
            if not messages:
                continue

            message = messages[0]
            phone_number_id = (value.get("metadata") or {}).get("phone_number_id")
            text = (message.get("text") or {}).get("body")
            action_id = None
            if text is None:
                button = message.get("button") or {}
                text = button.get("text")
                action_id = button.get("payload")

            interactive = message.get("interactive") or {}
            if text is None and "button_reply" in interactive:
                text = interactive["button_reply"].get("title") or interactive["button_reply"].get("id")
                action_id = interactive["button_reply"].get("id")
            if text is None and "list_reply" in interactive:
                text = interactive["list_reply"].get("title") or interactive["list_reply"].get("id")
                action_id = interactive["list_reply"].get("id")

            return {
                "phone_number_id": phone_number_id,
                "from_phone": message.get("from"),
                "text": text,
                "action_id": action_id,
            }
    return None


@router.post("/whatsapp")
async def receive_whatsapp_message(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    body = await request.body()
    if settings.whatsapp_app_secret and not verify_hmac_sha256_signature(
        settings.whatsapp_app_secret,
        body,
        x_hub_signature_256,
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid webhook signature")

    payload = await request.json()
    message = _extract_message(payload)
    if message is None or not message["from_phone"] or not message["text"]:
        return {"status": "accepted", "handled": False}

    hotel = db.scalar(
        select(Tenant).where(Tenant.whatsapp_phone_number_id == message["phone_number_id"])
    )
    if hotel is None:
        return {"status": "accepted", "handled": False, "reason": "unknown_whatsapp_phone_number_id"}

    flow_result = WhatsAppFlowService().process_text(
        db=db,
        hotel_id=hotel.id,
        hotel_name=hotel.name,
        phone=message["from_phone"],
        whatsapp_phone_number_id=message["phone_number_id"],
        text=message["text"],
        action_id=message["action_id"],
    )
    db.commit()

    if flow_result.ticket_event_payload is not None:
        await publish_ticket_event(hotel.id, "ticket.created", flow_result.ticket_event_payload)

    reply_sent = False
    if settings.whatsapp_access_token and message["phone_number_id"]:
        await WhatsAppService().send_text(
            message["phone_number_id"],
            message["from_phone"],
            flow_result.reply_text,
        )
        reply_sent = True

    return {
        "status": "accepted",
        "handled": True,
        "session_id": flow_result.session_id,
        "state": flow_result.state,
        "reply_sent": reply_sent,
    }


@router.post("/voice/inbound")
def receive_voice_call() -> Response:
    twiml = """
<Response>
  <Connect>
    <Stream url="wss://api.arcadia.com/ws/voice" />
  </Connect>
</Response>
""".strip()
    return Response(content=twiml, media_type="application/xml")

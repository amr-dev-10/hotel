from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.responses import ok
from app.services.bot_service import BotService
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(tags=["webhooks"])


@router.get("/webhook/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
) -> str:
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return hub_challenge or ""
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid verify token")


@router.post("/webhook/whatsapp")
async def receive_whatsapp_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    raw_body = await request.body()
    whatsapp = WhatsAppService()
    if not whatsapp.verify_webhook_signature(
        raw_body,
        request.headers.get("x-hub-signature-256"),
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    payload = await request.json()
    bot = BotService(db)
    outbound: list[dict] = []
    processed = 0
    for incoming in bot.parse_webhook_payload(payload):
        result = bot.handle_message(incoming)
        processed += 1
        for reply in result["replies"]:
            outbound.append(
                {
                    "incoming": incoming.__dict__,
                    "reply": reply,
                    "send_result": _send_reply(whatsapp, incoming, reply),
                }
            )

    return ok({"processed": processed, "outbound": outbound})


def _send_reply(whatsapp: WhatsAppService, incoming, reply: dict) -> dict:
    if reply["kind"] == "interactive_list":
        payload = reply.get("payload") or {}
        return whatsapp.send_interactive_list(
            incoming.phone_number_id,
            incoming.from_phone,
            reply.get("text") or "Choose an option",
            payload.get("button_text", "Open"),
            payload.get("rows", []),
        )
    return whatsapp.send_text(
        incoming.phone_number_id,
        incoming.from_phone,
        reply.get("text") or "Please choose an option from the menu.",
    )

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, set_tenant_context
from app.core.encryption import decrypt_secret
from app.core.responses import ok
from app.repositories.whatsapp_repository import WhatsAppAccountRepository
from app.services.bot_service import BotService
from app.services.whatsapp_ops_service import WhatsAppHealthService, WhatsAppUsageService
from app.services.whatsapp_service import WhatsAppService

router = APIRouter(tags=["webhooks"])


@router.get("/webhook/whatsapp")
def verify_whatsapp_webhook(
    hub_mode: str | None = Query(default=None, alias="hub.mode"),
    hub_verify_token: str | None = Query(default=None, alias="hub.verify_token"),
    hub_challenge: str | None = Query(default=None, alias="hub.challenge"),
):
    if hub_mode == "subscribe" and hub_verify_token == settings.whatsapp_verify_token:
        return PlainTextResponse(content=hub_challenge or "")
    return PlainTextResponse(content="Verification failed", status_code=403)


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
    accounts = WhatsAppAccountRepository(db)
    incoming_messages = bot.parse_webhook_payload(payload)
    resolved_messages = []
    for incoming in incoming_messages:
        if not incoming.phone_number_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="WhatsApp phone_number_id is missing from webhook metadata",
            )
        account = accounts.get_by_phone_number_id(incoming.phone_number_id)
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WhatsApp phone_number_id is not mapped to an active hotel account",
            )
        resolved_messages.append((incoming, account))

    for incoming, account in resolved_messages:
        set_tenant_context(db, account.hotel_id)
        WhatsAppHealthService(db).record_webhook(account.hotel_id, account.id, commit=False)
        WhatsAppUsageService(db).increment(account.hotel_id, "messages_received", commit=False)
        result = bot.handle_message(incoming)
        processed += 1
        access_token = _account_access_token(account)
        for reply in result["replies"]:
            send_result = _send_reply(
                whatsapp,
                incoming,
                reply,
                access_token=access_token,
            )
            WhatsAppHealthService(db).record_sent(account.hotel_id, account.id, commit=False)
            WhatsAppUsageService(db).increment(account.hotel_id, "messages_sent", commit=False)
            WhatsAppUsageService(db).increment(account.hotel_id, "api_calls", commit=False)
            outbound.append(
                {
                    "incoming": incoming.__dict__,
                    "reply": reply,
                    "send_result": send_result,
                }
            )
    db.commit()

    return ok({"processed": processed, "outbound": outbound})


def _account_access_token(account) -> str | None:
    if account.access_token_encrypted:
        return decrypt_secret(account.access_token_encrypted)
    return account.access_token


def _send_reply(
    whatsapp: WhatsAppService,
    incoming,
    reply: dict,
    access_token: str | None = None,
) -> dict:
    if reply["kind"] == "interactive_list":
        payload = reply.get("payload") or {}
        return whatsapp.send_interactive_list(
            incoming.phone_number_id,
            incoming.from_phone,
            reply.get("text") or "Choose an option",
            payload.get("button_text", "Open"),
            payload.get("rows", []),
            access_token=access_token,
        )
    return whatsapp.send_text(
        incoming.phone_number_id,
        incoming.from_phone,
        reply.get("text") or "Please choose an option from the menu.",
        access_token=access_token,
    )

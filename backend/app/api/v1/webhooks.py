from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, set_tenant_context
from app.core.encryption import decrypt_secret
from app.core.responses import ok
from app.repositories.whatsapp_repository import WhatsAppAccountRepository, WhatsAppMessageRepository
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
    duplicates = 0
    status_updates = 0
    accounts = WhatsAppAccountRepository(db)
    messages = WhatsAppMessageRepository(db)
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

    resolved_statuses = []
    for status_item in _parse_status_payload(payload):
        if not status_item["phone_number_id"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="WhatsApp phone_number_id is missing from status metadata",
            )
        account = accounts.get_by_phone_number_id(status_item["phone_number_id"])
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="WhatsApp phone_number_id is not mapped to an active hotel account",
            )
        resolved_statuses.append((status_item, account))

    for incoming, account in resolved_messages:
        set_tenant_context(db, account.hotel_id)
        WhatsAppHealthService(db).record_webhook(account.hotel_id, account.id, commit=False)
        if incoming.meta_message_id and messages.get_by_meta_message_id(
            account.hotel_id,
            incoming.meta_message_id,
        ):
            duplicates += 1
            continue
        WhatsAppUsageService(db).increment(account.hotel_id, "messages_received", commit=False)
        result = bot.handle_message(incoming, whatsapp_account_id=account.id)
        processed += 1
        access_token = _account_access_token(account)
        outbound_message_ids = result.get("outbound_message_ids") or []
        for index, reply in enumerate(result["replies"]):
            send_result = _send_reply(
                whatsapp,
                incoming,
                reply,
                access_token=access_token,
            )
            meta_reply_id = _meta_message_id_from_send_result(send_result)
            if meta_reply_id and index < len(outbound_message_ids):
                outbound_message = db.get(messages.model, outbound_message_ids[index])
                if outbound_message:
                    outbound_message.meta_message_id = meta_reply_id
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
    for status_item, account in resolved_statuses:
        set_tenant_context(db, account.hotel_id)
        WhatsAppHealthService(db).record_webhook(account.hotel_id, account.id, commit=False)
        if messages.update_status_by_meta_message_id(
            account.hotel_id,
            status_item["meta_message_id"],
            status_item["status"],
        ):
            status_updates += 1
    db.commit()

    return ok(
        {
            "processed": processed,
            "duplicates": duplicates,
            "status_updates": status_updates,
            "outbound": outbound,
        }
    )


def _account_access_token(account) -> str | None:
    if account.access_token_encrypted:
        return decrypt_secret(account.access_token_encrypted)
    return account.access_token


def _parse_status_payload(payload: dict) -> list[dict[str, str | None]]:
    statuses: list[dict[str, str | None]] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            for item in value.get("statuses", []):
                if item.get("id") and item.get("status"):
                    statuses.append(
                        {
                            "phone_number_id": phone_number_id,
                            "meta_message_id": item["id"],
                            "status": item["status"],
                        }
                    )
    return statuses


def _meta_message_id_from_send_result(send_result: dict) -> str | None:
    sent_messages = send_result.get("messages")
    if not isinstance(sent_messages, list) or not sent_messages:
        return None
    first = sent_messages[0]
    if not isinstance(first, dict):
        return None
    message_id = first.get("id")
    return message_id if isinstance(message_id, str) else None


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

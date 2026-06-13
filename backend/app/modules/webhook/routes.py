from typing import Any

from fastapi import APIRouter, HTTPException, Query, Response, status

from app.core.config import settings

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


@router.post("/whatsapp")
def receive_whatsapp_message(payload: dict[str, Any]) -> dict[str, str]:
    return {"status": "accepted"}


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

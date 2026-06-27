from typing import Any

import httpx

from app.core.config import settings
from app.core.security import verify_meta_signature


class WhatsAppService:
    def verify_webhook_signature(self, raw_body: bytes, signature_header: str | None) -> bool:
        return verify_meta_signature(raw_body, signature_header, settings.whatsapp_app_secret)

    def send_text(
        self,
        phone_number_id: str | None,
        to_phone: str,
        text: str,
        access_token: str | None = None,
    ) -> dict[str, Any]:
        return self._send(
            phone_number_id,
            {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "text",
                "text": {"body": text},
            },
            access_token=access_token,
        )

    def send_interactive_list(
        self,
        phone_number_id: str | None,
        to_phone: str,
        body: str,
        button_text: str,
        rows: list[dict[str, str]],
        section_title: str = "Options",
        access_token: str | None = None,
    ) -> dict[str, Any]:
        return self._send(
            phone_number_id,
            {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "interactive",
                "interactive": {
                    "type": "list",
                    "body": {"text": body},
                    "action": {
                        "button": button_text,
                        "sections": [{"title": section_title, "rows": rows}],
                    },
                },
            },
            access_token=access_token,
        )

    def send_template(
        self,
        phone_number_id: str | None,
        to_phone: str,
        template_name: str,
        params: list[str],
        language_code: str = "en",
        access_token: str | None = None,
    ) -> dict[str, Any]:
        return self._send(
            phone_number_id,
            {
                "messaging_product": "whatsapp",
                "to": to_phone,
                "type": "template",
                "template": {
                    "name": template_name,
                    "language": {"code": language_code},
                    "components": [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": value} for value in params
                            ],
                        }
                    ],
                },
            },
            access_token=access_token,
        )

    def _send(
        self,
        phone_number_id: str | None,
        payload: dict[str, Any],
        access_token: str | None = None,
    ) -> dict[str, Any]:
        if settings.whatsapp_dry_run:
            return {"dry_run": True, "payload": payload}
        if not phone_number_id:
            raise RuntimeError("WhatsApp phone_number_id is required")
        if not access_token:
            raise RuntimeError("WhatsApp access token is required for this account")

        url = (
            f"https://graph.facebook.com/{settings.whatsapp_api_version}/"
            f"{phone_number_id}/messages"
        )
        response = httpx.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        response.raise_for_status()
        return response.json()

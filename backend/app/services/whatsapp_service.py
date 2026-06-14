from typing import Any

import httpx

from app.core.config import settings


class WhatsAppService:
    def __init__(self, access_token: str | None = None, api_url: str | None = None) -> None:
        self.access_token = access_token or settings.whatsapp_access_token
        self.api_url = (api_url or settings.whatsapp_graph_api_url).rstrip("/")

    async def send_text(self, phone_number_id: str, to_phone: str, body: str) -> dict[str, Any]:
        if not self.access_token:
            raise RuntimeError("WHATSAPP_ACCESS_TOKEN is not configured")
        url = f"{self.api_url}/{phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": body},
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

    async def send_template(
        self,
        phone_number_id: str,
        to_phone: str,
        template_name: str,
        parameters: list[str],
        language_code: str = "en",
    ) -> dict[str, Any]:
        if not self.access_token:
            raise RuntimeError("WHATSAPP_ACCESS_TOKEN is not configured")
        url = f"{self.api_url}/{phone_number_id}/messages"
        headers = {"Authorization": f"Bearer {self.access_token}"}
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": language_code},
                "components": [
                    {
                        "type": "body",
                        "parameters": [{"type": "text", "text": value} for value in parameters],
                    }
                ],
            },
        }
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()
            return response.json()

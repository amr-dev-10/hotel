from typing import Any

from app.integrations.ai.factory import ResilientAIProvider
from app.services.defaults import DEFAULT_SERVICES


class GeminiService:
    def classify_free_text(
        self,
        text: str,
        services: list[dict[str, Any]] | None = None,
        guest_name: str | None = None,
    ) -> dict[str, Any]:
        result = ResilientAIProvider().classify(text, services or DEFAULT_SERVICES)
        result["guest_name"] = guest_name
        return result

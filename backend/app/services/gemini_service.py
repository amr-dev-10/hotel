from typing import Any

from app.services.defaults import DEFAULT_SERVICES


class GeminiService:
    def classify_free_text(
        self,
        text: str,
        services: list[dict[str, Any]] | None = None,
        guest_name: str | None = None,
    ) -> dict[str, Any]:
        lowered = text.lower()
        for service in services or DEFAULT_SERVICES:
            haystack = [
                service.get("id", ""),
                service.get("title", ""),
                service.get("item", ""),
                service.get("department_key", ""),
                *(service.get("keywords") or []),
            ]
            if any(str(part).lower() in lowered for part in haystack if part):
                return {
                    "matched": True,
                    "service_id": service.get("id"),
                    "department_key": service.get("department_key"),
                    "item": service.get("item") or service.get("title"),
                    "priority": service.get("priority", 2),
                    "guest_name": guest_name,
                }
        return {"matched": False}

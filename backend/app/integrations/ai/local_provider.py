from typing import Any

from app.integrations.ai.base import AIProvider


class LocalProvider(AIProvider):
    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        return prompt[:max_tokens]

    def embed(self, text: str) -> list[float]:
        words = sorted({word.lower() for word in text.split() if len(word) > 2})[:32]
        return [float((sum(ord(char) for char in word) % 997) / 997) for word in words]

    def classify(self, text: str, categories: list[dict[str, Any]]) -> dict[str, Any]:
        lowered = text.lower()
        for category in categories:
            haystack = [
                category.get("id", ""),
                category.get("title", ""),
                category.get("item", ""),
                category.get("department_key", ""),
                *(category.get("keywords") or []),
            ]
            if any(str(part).lower() in lowered for part in haystack if part):
                return {
                    "matched": True,
                    "service_id": category.get("id"),
                    "department_key": category.get("department_key"),
                    "item": category.get("item") or category.get("title"),
                    "priority": category.get("priority", 2),
                }
        return {"matched": False}

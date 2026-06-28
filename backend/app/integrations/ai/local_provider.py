import json
from typing import Any

from app.integrations.ai.base import AIProvider


class LocalProvider(AIProvider):
    provider_name = "local"

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self.api_key = api_key
        self.model = model or "local-keyword"

    def generate(
        self,
        prompt: str,
        system: str | None = None,
        temperature: float = 0.3,
        max_tokens: int = 1024,
    ) -> str:
        return prompt[:max_tokens]

    def chat(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 1024,
        response_format: str | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        text = self._last_user_message(messages)
        decision = self._decision_from_text(text)
        content = json.dumps(decision)
        prompt_tokens = self._estimate_tokens(" ".join(message.get("content", "") for message in messages))
        completion_tokens = self._estimate_tokens(content)
        return {
            "content": content[:max_tokens],
            "model": model or self.model,
            "provider": self.provider_name,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "finish_reason": "stop",
        }

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

    def _last_user_message(self, messages: list[dict[str, str]]) -> str:
        for message in reversed(messages):
            if message.get("role") == "user":
                return self._guest_message_from_content(message.get("content", ""))
        return messages[-1].get("content", "") if messages else ""

    def _guest_message_from_content(self, content: str) -> str:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end < start:
            return content
        try:
            payload = json.loads(content[start : end + 1])
        except json.JSONDecodeError:
            return content
        guest_message = payload.get("guest_message")
        return guest_message if isinstance(guest_message, str) else content

    def _decision_from_text(self, text: str) -> dict[str, Any]:
        lowered = text.lower()
        if any(word in lowered for word in ("fire", "medical", "doctor", "ambulance", "emergency")):
            return self._ticket_decision(
                "emergency",
                0.98,
                "negative",
                "Emergency assistance",
                "Guest message indicates an emergency and needs immediate staff attention.",
                "front_office",
                "emergency",
                1,
                "I have alerted our team immediately. Please stay where you are if it is safe.",
            )
        if any(word in lowered for word in ("angry", "complaint", "unhappy", "terrible", "dirty", "bad service")):
            return self._ticket_decision(
                "complaint",
                0.88,
                "negative",
                "Guest complaint",
                "Guest expressed dissatisfaction and needs staff follow-up.",
                "front_office",
                "guest_request",
                1,
                "I am sorry about this. I will ask our team to review it right away.",
            )
        if any(word in lowered for word in ("towel", "pillow", "blanket", "clean", "cleaning", "water")):
            return self._ticket_decision(
                "housekeeping",
                0.92,
                "neutral",
                "Housekeeping request",
                "Guest requested housekeeping assistance.",
                "housekeeping",
                "housekeeping",
                2,
                "I can help with that. I will share this with housekeeping.",
            )
        if any(word in lowered for word in ("ac", "air condition", "tv", "leak", "plumbing", "power", "light")):
            return self._ticket_decision(
                "maintenance",
                0.9,
                "neutral",
                "Maintenance request",
                "Guest reported a room maintenance issue.",
                "engineering",
                "maintenance",
                2,
                "I will notify maintenance so they can check this.",
            )
        if any(word in lowered for word in ("food", "menu", "coffee", "tea", "breakfast", "dinner", "order")):
            return self._ticket_decision(
                "food_order",
                0.86,
                "neutral",
                "Food and beverage request",
                "Guest asked for food or beverage assistance.",
                "food_beverage",
                "room_service",
                3,
                "I will share this with our food and beverage team.",
            )
        if any(word in lowered for word in ("wifi", "checkout", "pool", "gym", "breakfast time", "restaurant")):
            return {
                "intent": "information_request",
                "confidence": 0.76,
                "sentiment": "neutral",
                "ticket_required": False,
                "reply_required": True,
                "reply": "Let me check that for you. A staff member can confirm the latest details.",
                "reason": "The message appears to ask for hotel information.",
            }
        return {
            "intent": "unknown",
            "confidence": 0.45,
            "sentiment": "neutral",
            "ticket_required": True,
            "reply_required": False,
            "ticket": {
                "title": "AI escalation",
                "description": "Guest message could not be confidently understood by the AI fallback.",
                "department_key": "front_office",
                "task_category": "guest_request",
                "priority": 2,
            },
            "reason": "No local keyword match was confident enough.",
        }

    def _ticket_decision(
        self,
        intent: str,
        confidence: float,
        sentiment: str,
        title: str,
        description: str,
        department_key: str,
        task_category: str,
        priority: int,
        reply: str,
    ) -> dict[str, Any]:
        return {
            "intent": intent,
            "confidence": confidence,
            "sentiment": sentiment,
            "ticket_required": True,
            "reply_required": True,
            "ticket": {
                "title": title,
                "description": description,
                "department_key": department_key,
                "task_category": task_category,
                "priority": priority,
            },
            "reply": reply,
            "reason": "Matched local hotel-operation keywords.",
        }

    def _estimate_tokens(self, text: str) -> int:
        return max(1, len(text.split()))

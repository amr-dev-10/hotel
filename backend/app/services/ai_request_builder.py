import json

from app.schemas.ai import AIContext


DEFAULT_SYSTEM_PROMPT = """You are Arcadia's hotel guest operations assistant.
Understand the guest's message, use only the provided hotel context and knowledge,
and return a single JSON object. Do not invent hotel policy details.
When confidence is low, do not create a guest-facing reply; request staff review."""


class AIRequestBuilder:
    @staticmethod
    def build_chat_messages(
        config: dict,
        context: AIContext,
        message: str,
        staff_context: str | None = None,
    ) -> list[dict[str, str]]:
        system_prompt = config.get("system_prompt") or DEFAULT_SYSTEM_PROMPT
        payload = {
            "guest_message": message,
            "staff_context": staff_context,
            "hotel": context.hotel,
            "guest": context.guest,
            "reservation": context.reservation,
            "room": context.room,
            "conversation_summary": context.conversation_summary,
            "recent_messages": context.messages,
            "open_tickets": context.open_tickets,
            "knowledge": context.knowledge,
            "language": context.language,
            "output_schema": {
                "intent": "housekeeping | maintenance | food_order | complaint | emergency | information_request | guest_request | unknown",
                "confidence": "number between 0 and 1",
                "sentiment": "positive | neutral | negative",
                "ticket_required": "boolean",
                "reply_required": "boolean",
                "reply": "short guest-facing message or null",
                "reason": "short operational explanation",
                "ticket": {
                    "title": "short staff-facing title",
                    "description": "staff-facing details",
                    "department_key": "front_office | housekeeping | engineering | food_beverage",
                    "task_category": "guest_request | housekeeping | maintenance | room_service | emergency",
                    "priority": "1-5, where 1 is urgent",
                },
            },
        }
        return [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Analyze this hotel guest conversation and return only valid JSON.\n"
                    f"{json.dumps(payload, default=str)}"
                ),
            },
        ]

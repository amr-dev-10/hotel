import json
from typing import Any

from pydantic import ValidationError

from app.schemas.ai import AIDecision, AITicketSuggestion


class AIResponseParser:
    @staticmethod
    def parse(response: dict[str, Any]) -> AIDecision:
        content = str(response.get("content") or "").strip()
        try:
            data = json.loads(AIResponseParser._extract_json(content))
            decision = AIDecision.model_validate(data)
        except (json.JSONDecodeError, ValidationError, ValueError) as exc:
            return AIDecision(
                intent="unknown",
                confidence=0.0,
                sentiment="neutral",
                ticket_required=True,
                reply_required=False,
                ticket=AITicketSuggestion(
                    title="AI response parsing failed",
                    description=f"AI response could not be parsed safely: {exc}",
                    department_key="front_office",
                    task_category="guest_request",
                    priority=2,
                ),
                reason="AI response parser failed; staff review required.",
                parse_error=True,
            )
        if decision.ticket_required and not decision.ticket:
            decision.ticket = AITicketSuggestion(
                title=f"{decision.intent.replace('_', ' ').title()} request",
                description=decision.reason or "Guest request requires staff attention.",
            )
        if decision.confidence < 0:
            decision.confidence = 0
        if decision.confidence > 1:
            decision.confidence = 1
        return decision

    @staticmethod
    def _extract_json(content: str) -> str:
        if content.startswith("```"):
            content = content.strip("`").strip()
            if content.lower().startswith("json"):
                content = content[4:].strip()
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end < start:
            raise ValueError("No JSON object found")
        return content[start : end + 1]

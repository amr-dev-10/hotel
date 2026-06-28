from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.vault import Vault
from app.integrations.ai.anthropic_provider import AnthropicProvider
from app.integrations.ai.factory import get_ai_provider
from app.integrations.ai.gemini_provider import GeminiProvider
from app.integrations.ai.groq_provider import GroqProvider
from app.integrations.ai.local_provider import LocalProvider
from app.integrations.ai.openai_provider import OpenAIProvider
from app.main import app
from app.models.base import utcnow
from app.models.ticket import Ticket
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.schemas.ai import AIDecision
from app.services.ai_analytics_service import AIAnalyticsService
from app.services.ai_decision_engine import AIDecisionEngine
from app.services.ai_response_parser import AIResponseParser


def _bootstrap(client: TestClient) -> tuple[str, dict[str, str]]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"ai-hotel-{suffix}",
            "name": "Arcadia AI Test Hotel",
            "owner_name": "AI Owner",
            "owner_email": f"ai-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "contact_phone": "+919000511111",
            "whatsapp_phone_number_id": f"ai_phone_{suffix}",
            "seed_rooms": ["1201"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], {"Authorization": f"Bearer {data['access_token']}"}


def _conversation(hotel_id: str) -> str:
    db = SessionLocal()
    try:
        conversation = WhatsAppConversation(
            hotel_id=hotel_id,
            whatsapp_account_id=None,
            guest_id=None,
            phone=f"555{uuid4().hex[:8]}",
            status="open",
            priority="normal",
            started_at=utcnow(),
            last_message_at=utcnow(),
        )
        db.add(conversation)
        db.flush()
        db.add(
            WhatsAppMessage(
                hotel_id=hotel_id,
                whatsapp_account_id=None,
                conversation_id=conversation.id,
                reservation_id=None,
                ticket_id=None,
                direction="inbound",
                message_type="text",
                message_text="Hello",
                status="received",
                created_at=utcnow(),
            )
        )
        db.commit()
        return conversation.id
    finally:
        db.close()


def test_local_provider_returns_structured_housekeeping_decision() -> None:
    response = LocalProvider().chat(
        [
            {"role": "system", "content": "Return JSON."},
            {"role": "user", "content": "Can I get two extra towels?"},
        ],
        response_format="json_object",
    )

    decision = AIResponseParser.parse(response)

    assert decision.intent == "housekeeping"
    assert decision.confidence >= 0.9
    assert decision.ticket_required is True
    assert decision.ticket is not None
    assert decision.ticket.department_key == "housekeeping"


def test_groq_provider_is_registered_with_default_model() -> None:
    provider = get_ai_provider("groq", api_key="test-groq-key")

    assert isinstance(provider, GroqProvider)
    assert provider.provider_name == "groq"
    assert provider.api_key == "test-groq-key"
    assert provider.model == "llama-3.3-70b-versatile"


def test_groq_provider_requires_hotel_api_key() -> None:
    with pytest.raises(RuntimeError, match="Groq API key is not configured"):
        GroqProvider().chat([{"role": "user", "content": "Hello"}])


@pytest.mark.parametrize(
    ("provider_cls", "error"),
    [
        (OpenAIProvider, "OpenAI API key is not configured"),
        (GeminiProvider, "Gemini API key is not configured"),
        (AnthropicProvider, "Anthropic API key is not configured"),
    ],
)
def test_real_providers_require_hotel_api_key(provider_cls, error: str) -> None:
    with pytest.raises(RuntimeError, match=error):
        provider_cls().chat([{"role": "user", "content": "Hello"}])


def test_unknown_provider_fails_instead_of_falling_back_to_local() -> None:
    with pytest.raises(RuntimeError, match="Unsupported AI provider 'typo-provider'"):
        get_ai_provider("typo-provider")


def test_groq_provider_uses_openai_compatible_client(monkeypatch: pytest.MonkeyPatch) -> None:
    openai = pytest.importorskip("openai")
    calls: dict[str, dict] = {}

    class FakeCompletions:
        def create(self, **kwargs):
            calls["completion_kwargs"] = kwargs
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(content='{"intent":"information","confidence":0.9}'),
                        finish_reason="stop",
                    )
                ],
                model=kwargs["model"],
                usage=SimpleNamespace(prompt_tokens=12, completion_tokens=8, total_tokens=20),
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            calls["client_kwargs"] = kwargs
            self.chat = SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setattr(openai, "OpenAI", FakeOpenAI)

    response = GroqProvider(api_key="test-groq-key").chat(
        [{"role": "user", "content": "What time is checkout?"}],
        temperature=0.2,
        max_tokens=128,
        response_format="json_object",
    )

    assert calls["client_kwargs"] == {
        "api_key": "test-groq-key",
        "base_url": "https://api.groq.com/openai/v1",
    }
    assert calls["completion_kwargs"]["model"] == "llama-3.3-70b-versatile"
    assert calls["completion_kwargs"]["messages"][0]["content"] == "What time is checkout?"
    assert calls["completion_kwargs"]["temperature"] == 0.2
    assert calls["completion_kwargs"]["max_tokens"] == 128
    assert calls["completion_kwargs"]["response_format"] == {"type": "json_object"}
    assert response["provider"] == "groq"
    assert response["model"] == "llama-3.3-70b-versatile"
    assert response["total_tokens"] == 20


def test_groq_cost_estimate_uses_configured_model_pricing() -> None:
    cost = AIAnalyticsService.get_cost_estimate(
        "groq",
        "llama-3.3-70b-versatile",
        prompt_tokens=1_000_000,
        completion_tokens=1_000_000,
    )

    assert cost == 1.38


def test_ai_settings_reuses_existing_hotel_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    seen_keys: list[str | None] = []

    def fake_generate(self, *args, **kwargs):
        seen_keys.append(self.api_key)
        return "ok"

    monkeypatch.setattr(GroqProvider, "generate", fake_generate)

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap(client)
        first = client.put(
            f"/api/v1/hotels/{hotel_id}/settings/ai",
            headers=headers,
            json={
                "provider": "groq",
                "api_key": "hotel-groq-key",
                "model": "llama-3.3-70b-versatile",
            },
        )
        assert first.status_code == 200

        second = client.put(
            f"/api/v1/hotels/{hotel_id}/settings/ai",
            headers=headers,
            json={
                "provider": "groq",
                "model": "llama-3.1-8b-instant",
                "temperature": 0.2,
            },
        )
        assert second.status_code == 200

    assert seen_keys == ["hotel-groq-key", "hotel-groq-key"]


def test_ai_settings_reset_deletes_hotel_provider_keys(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(GroqProvider, "generate", lambda self, *args, **kwargs: "ok")

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap(client)
        response = client.put(
            f"/api/v1/hotels/{hotel_id}/settings/ai",
            headers=headers,
            json={
                "provider": "groq",
                "api_key": "hotel-groq-key",
                "model": "llama-3.3-70b-versatile",
            },
        )
        assert response.status_code == 200

        reset = client.delete(f"/api/v1/hotels/{hotel_id}/settings/ai", headers=headers)
        assert reset.status_code == 200

        db = SessionLocal()
        try:
            assert Vault(db).retrieve(hotel_id, "ai:groq:api_key") is None
        finally:
            db.close()


def test_ai_response_parser_fails_closed_on_bad_json() -> None:
    decision = AIResponseParser.parse({"content": "not valid json"})

    assert decision.parse_error is True
    assert decision.confidence == 0
    assert decision.ticket_required is True
    assert decision.reply_required is False


def test_decision_engine_turns_high_confidence_into_ticket_suggestion() -> None:
    action = AIDecisionEngine.evaluate(
        AIDecision(
            intent="housekeeping",
            confidence=0.92,
            ticket_required=True,
            reply_required=True,
            reply="I will notify housekeeping.",
        ),
        {
            "high_confidence_threshold": 0.9,
            "low_confidence_threshold": 0.75,
            "enable_auto_reply": False,
            "enable_ticket_creation": True,
        },
        has_open_ticket=False,
    )

    assert action.reply_action == "suggest"
    assert action.ticket_action == "auto_create"
    assert action.escalation_action == "none"


def test_ai_chat_endpoint_uses_local_provider_and_creates_ticket() -> None:
    with TestClient(app) as client:
        hotel_id, headers = _bootstrap(client)
        conversation_id = _conversation(hotel_id)

        settings = client.put(
            f"/api/v1/hotels/{hotel_id}/settings/ai",
            headers=headers,
            json={
                "provider": "local",
                "model": "local-keyword",
                "is_active": True,
                "high_confidence_threshold": 0.9,
                "low_confidence_threshold": 0.75,
                "enable_ticket_creation": True,
                "enable_auto_reply": False,
            },
        )
        assert settings.status_code == 200

        response = client.post(
            f"/api/v1/hotels/{hotel_id}/ai/chat",
            headers=headers,
            json={
                "conversation_id": conversation_id,
                "message": "Please send extra towels to my room.",
            },
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["processed"] is True
        assert data["decision"]["intent"] == "housekeeping"
        assert data["action"]["ticket_action"] == "auto_create"
        assert data["ticket_created"] is True
        assert data["ticket_id"]
        assert data["suggested_reply"]

        db = SessionLocal()
        try:
            ticket = db.get(Ticket, data["ticket_id"])
            assert ticket is not None
            assert ticket.hotel_id == hotel_id
            assert ticket.conversation_id == conversation_id
            assert ticket.source == "AI"
            assert ticket.task_category == "housekeeping"
        finally:
            db.close()

        analytics = client.get(f"/api/v1/hotels/{hotel_id}/ai/analytics", headers=headers)
        assert analytics.status_code == 200
        assert analytics.json()["data"]["total_requests"] >= 1

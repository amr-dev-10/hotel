from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.integrations.ai.local_provider import LocalProvider
from app.main import app
from app.models.base import utcnow
from app.models.ticket import Ticket
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.schemas.ai import AIDecision
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

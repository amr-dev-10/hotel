from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.ticket import Ticket
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage


def _bootstrap(client: TestClient) -> tuple[str, dict[str, str]]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"portal-chat-{suffix}",
            "name": "Arcadia Portal Chat Hotel",
            "owner_name": "Portal Owner",
            "owner_email": f"portal-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "contact_phone": "+919000511111",
            "whatsapp_phone_number_id": f"portal_chat_phone_{suffix}",
            "seed_rooms": ["7301"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], {"Authorization": f"Bearer {data['access_token']}"}


def _room_id(client: TestClient, hotel_id: str, headers: dict[str, str], room_number: str) -> str:
    response = client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=headers)
    assert response.status_code == 200
    return next(item["id"] for item in response.json()["data"] if item["room_number"] == room_number)


def _portal_headers(client: TestClient, hotel_id: str, staff_headers: dict[str, str]) -> tuple[dict[str, str], str]:
    suffix = uuid4().hex[:8]
    phone = f"555{suffix[:7]}"
    room_id = _room_id(client, hotel_id, staff_headers, "7301")
    reservation = client.post(
        f"/api/v1/hotels/{hotel_id}/reservations",
        headers=staff_headers,
        json={
            "guest_name": "Portal Chat Guest",
            "phone": phone,
            "room_id": room_id,
            "checkin_date": date.today().isoformat(),
            "checkout_date": (date.today() + timedelta(days=1)).isoformat(),
            "source": "walk_in",
        },
    )
    assert reservation.status_code == 200
    reservation_id = reservation.json()["data"]["id"]
    assert client.post(
        f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-in",
        headers=staff_headers,
    ).status_code == 200

    login = client.post(
        "/api/v1/guest-portal/auth/login",
        json={"hotel_id": hotel_id, "phone": phone, "room_number": "7301"},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['data']['access_token']}"}, reservation.json()["data"]["guest_id"]


def test_guest_portal_chat_sends_ai_reply_and_lists_portal_messages() -> None:
    with TestClient(app) as client:
        hotel_id, staff_headers = _bootstrap(client)
        portal_headers, guest_id = _portal_headers(client, hotel_id, staff_headers)

        settings = client.put(
            f"/api/v1/hotels/{hotel_id}/settings/ai",
            headers=staff_headers,
            json={
                "provider": "local",
                "model": "local-keyword",
                "is_active": True,
                "high_confidence_threshold": 0.9,
                "low_confidence_threshold": 0.75,
                "enable_ticket_creation": True,
                "enable_auto_reply": True,
            },
        )
        assert settings.status_code == 200

        unauthenticated = client.get("/api/v1/guest-portal/chat/messages")
        assert unauthenticated.status_code == 403

        conversation = client.get("/api/v1/guest-portal/chat/conversation", headers=portal_headers)
        assert conversation.status_code == 200
        conversation_id = conversation.json()["data"]["id"]

        sent = client.post(
            "/api/v1/guest-portal/chat/send",
            headers=portal_headers,
            json={"message": "Please send extra towels to my room."},
        )
        assert sent.status_code == 200
        data = sent.json()["data"]
        assert data["conversation_id"] == conversation_id
        assert data["inbound_message"]["direction"] == "inbound"
        assert data["ai_reply"]["direction"] == "outbound"
        assert data["intent"] == "housekeeping"
        assert data["ticket_id"]

        history = client.get("/api/v1/guest-portal/chat/messages", headers=portal_headers)
        assert history.status_code == 200
        messages = history.json()["data"]
        assert [message["direction"] for message in messages] == ["inbound", "outbound"]
        assert messages[0]["message_text"] == "Please send extra towels to my room."

        db = SessionLocal()
        try:
            stored_conversation = db.get(WhatsAppConversation, conversation_id)
            assert stored_conversation is not None
            assert stored_conversation.guest_id == guest_id
            stored_messages = db.execute(
                select(WhatsAppMessage).where(WhatsAppMessage.conversation_id == conversation_id)
            ).scalars().all()
            assert len(stored_messages) == 2
            assert {message.whatsapp_account_id for message in stored_messages} == {None}
            ticket = db.get(Ticket, data["ticket_id"])
            assert ticket is not None
            assert ticket.conversation_id == conversation_id
            assert ticket.source == "AI"
        finally:
            db.close()

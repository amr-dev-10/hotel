from uuid import uuid4

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.whatsapp_session import WhatsAppSession
from app.services import whatsapp_service
from app.services.whatsapp_service import WhatsAppService


def _meta_payload(
    phone_number_id: str,
    from_phone: str,
    text: str | None = None,
    interactive_id: str | None = None,
    message_id: str | None = None,
) -> dict:
    message: dict = {"from": from_phone}
    if message_id:
        message["id"] = message_id
    if interactive_id:
        message.update(
            {
                "type": "interactive",
                "interactive": {
                    "list_reply": {
                        "id": interactive_id,
                        "title": interactive_id,
                    }
                },
            }
        )
    else:
        message.update({"type": "text", "text": {"body": text or ""}})

    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": phone_number_id},
                            "messages": [message],
                        }
                    }
                ]
            }
        ]
    }


def _status_payload(phone_number_id: str, message_id: str, message_status: str) -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": phone_number_id},
                            "statuses": [
                                {
                                    "id": message_id,
                                    "status": message_status,
                                    "timestamp": "1710000000",
                                    "recipient_id": "919999999999",
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }


def _bootstrap_hotel(client: TestClient, suffix: str, phone_number_id: str, room_number: str) -> tuple[str, dict[str, str]]:
    bootstrap = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"hotel-{suffix}",
            "name": f"Hotel {suffix}",
            "owner_name": "Arcadia Owner",
            "owner_email": f"owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "whatsapp_phone_number_id": phone_number_id,
            "seed_rooms": [room_number],
        },
    )
    assert bootstrap.status_code == 200
    data = bootstrap.json()["data"]
    return data["hotel"]["id"], {"Authorization": f"Bearer {data['access_token']}"}


def test_bootstrap_login_whatsapp_onboarding_and_ticket() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"phone_{suffix}"
    guest_phone = f"9198765{suffix[:5]}"

    with TestClient(app) as client:
        bootstrap = client.post(
            "/api/v1/hotels/bootstrap",
            json={
                "slug": f"grand-{suffix}",
                "name": "The Grand Palace",
                "owner_name": "Arcadia Owner",
                "owner_email": f"owner-{suffix}@example.com",
                "owner_password": "secretpass123",
                "whatsapp_phone_number_id": phone_number_id,
                "seed_rooms": ["204"],
            },
        )
        assert bootstrap.status_code == 200
        bootstrap_data = bootstrap.json()["data"]
        hotel_id = bootstrap_data["hotel"]["id"]
        token = bootstrap_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        login = client.post(
            "/api/v1/auth/login",
            json={
                "email": f"owner-{suffix}@example.com",
                "password": "secretpass123",
            },
        )
        assert login.status_code == 200
        assert login.json()["data"]["access_token"]

        departments = client.get(
            f"/api/v1/hotels/{hotel_id}/departments",
            headers=headers,
        )
        assert departments.status_code == 200
        assert len(departments.json()["data"]) >= 4

        start = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Hi"),
        )
        assert start.status_code == 200
        assert start.json()["data"]["processed"] == 1
        assert "share your name" in start.json()["data"]["outbound"][0]["reply"]["text"]

        name = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Rahul Sharma"),
        )
        assert name.status_code == 200
        assert "room number" in name.json()["data"]["outbound"][0]["reply"]["text"]

        room = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="204"),
        )
        assert room.status_code == 200
        assert any(
            item["reply"]["kind"] == "interactive_list"
            for item in room.json()["data"]["outbound"]
        )

        room_services = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, interactive_id="main_room_service"),
        )
        assert room_services.status_code == 200
        rows = room_services.json()["data"]["outbound"][0]["reply"]["payload"]["rows"]
        assert any(row["id"] == "ac_not_working" for row in rows)

        ticket = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, interactive_id="ac_not_working"),
        )
        assert ticket.status_code == 200
        assert "Request ID" in ticket.json()["data"]["outbound"][0]["reply"]["text"]

        tickets = client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=headers)
        assert tickets.status_code == 200
        assert len(tickets.json()["data"]) == 1
        assert tickets.json()["data"][0]["item_description"] == "AC Not Working"


def test_whatsapp_webhook_rejects_unmapped_phone_number_id() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"mapped_{suffix}"
    unknown_phone_number_id = f"unknown_{suffix}"
    guest_phone = f"9191111{suffix[:5]}"

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap_hotel(client, f"mapped-{suffix}", phone_number_id, "101")

        webhook = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(unknown_phone_number_id, guest_phone, text="Hi"),
        )
        assert webhook.status_code == 404
        error = webhook.json()["detail"]
        assert "not mapped" in error["message"]
        assert error["code"] == "not_found"
        assert error["request_id"]

        conversations = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=headers,
        )
        assert conversations.status_code == 200
        assert conversations.json()["data"] == []


def test_whatsapp_webhook_routes_same_guest_phone_to_correct_hotel_account() -> None:
    suffix = uuid4().hex[:8]
    hotel_a_phone_number_id = f"hotel_a_{suffix}"
    hotel_b_phone_number_id = f"hotel_b_{suffix}"
    guest_phone = f"9192222{suffix[:5]}"

    with TestClient(app) as client:
        hotel_a_id, hotel_a_headers = _bootstrap_hotel(
            client,
            f"a-{suffix}",
            hotel_a_phone_number_id,
            "201",
        )
        hotel_b_id, hotel_b_headers = _bootstrap_hotel(
            client,
            f"b-{suffix}",
            hotel_b_phone_number_id,
            "301",
        )

        webhook = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(hotel_b_phone_number_id, guest_phone, text="Hi"),
        )
        assert webhook.status_code == 200
        assert webhook.json()["data"]["processed"] == 1

        hotel_a_conversations = client.get(
            f"/api/v1/hotels/{hotel_a_id}/whatsapp/conversations",
            headers=hotel_a_headers,
        )
        assert hotel_a_conversations.status_code == 200
        assert hotel_a_conversations.json()["data"] == []

        hotel_b_conversations = client.get(
            f"/api/v1/hotels/{hotel_b_id}/whatsapp/conversations",
            headers=hotel_b_headers,
        )
        assert hotel_b_conversations.status_code == 200
        assert len(hotel_b_conversations.json()["data"]) == 1
        assert hotel_b_conversations.json()["data"][0]["phone"] == guest_phone


def test_whatsapp_webhook_deduplicates_retried_meta_message_id() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"dedupe_{suffix}"
    guest_phone = f"9193333{suffix[:5]}"
    meta_message_id = f"wamid.{suffix}"

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap_hotel(client, f"dedupe-{suffix}", phone_number_id, "401")

        first = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Hi", message_id=meta_message_id),
        )
        assert first.status_code == 200
        assert first.json()["data"]["processed"] == 1
        assert first.json()["data"]["duplicates"] == 0

        retry = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Hi", message_id=meta_message_id),
        )
        assert retry.status_code == 200
        assert retry.json()["data"]["processed"] == 0
        assert retry.json()["data"]["duplicates"] == 1
        assert retry.json()["data"]["outbound"] == []

        conversations = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=headers,
        )
        conversation_id = conversations.json()["data"][0]["id"]
        messages = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations/{conversation_id}/messages",
            headers=headers,
        )
        assert messages.status_code == 200
        assert len(messages.json()["data"]) == 2
        assert messages.json()["data"][0]["meta_message_id"] == meta_message_id


def test_delete_whatsapp_conversation_profile_unlinks_guest_and_session() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"profile_delete_{suffix}"
    guest_phone = f"9195555{suffix[:5]}"

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap_hotel(client, f"profile-delete-{suffix}", phone_number_id, "451")

        assert client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Hi"),
        ).status_code == 200
        assert client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Profile Delete Guest"),
        ).status_code == 200
        assert client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="451"),
        ).status_code == 200

        conversations = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=headers,
        )
        assert conversations.status_code == 200
        conversation = next(item for item in conversations.json()["data"] if item["phone"] == guest_phone)
        assert conversation["guest_id"]

        deleted = client.delete(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations/{conversation['id']}/profile",
            headers=headers,
        )
        assert deleted.status_code == 200
        assert deleted.json()["data"]["guest_id"] is None

        db = SessionLocal()
        try:
            session = db.execute(
                select(WhatsAppSession).where(
                    WhatsAppSession.hotel_id == hotel_id,
                    WhatsAppSession.phone == guest_phone,
                )
            ).scalar_one()
            assert session.guest_id is None
            assert session.room_id is None
            assert session.state == "new"
        finally:
            db.close()

        messages = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations/{conversation['id']}/messages",
            headers=headers,
        )
        assert messages.status_code == 200
        assert messages.json()["data"]


def test_whatsapp_status_webhook_updates_existing_message_status() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"status_{suffix}"
    guest_phone = f"9194444{suffix[:5]}"
    meta_message_id = f"wamid.status.{suffix}"

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap_hotel(client, f"status-{suffix}", phone_number_id, "501")

        inbound = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="Hi", message_id=meta_message_id),
        )
        assert inbound.status_code == 200

        status_update = client.post(
            "/webhook/whatsapp",
            json=_status_payload(phone_number_id, meta_message_id, "read"),
        )
        assert status_update.status_code == 200
        assert status_update.json()["data"]["status_updates"] == 1

        conversations = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=headers,
        )
        conversation_id = conversations.json()["data"][0]["id"]
        messages = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations/{conversation_id}/messages",
            headers=headers,
        )
        updated = next(
            item for item in messages.json()["data"] if item["meta_message_id"] == meta_message_id
        )
        assert updated["status"] == "read"


def test_guest_whatsapp_phone_update_syncs_conversation_send_target() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"sync_{suffix}"
    old_guest_phone = f"300{suffix[:7]}"
    corrected_guest_phone = f"92300{suffix[:7]}"

    with TestClient(app) as client:
        hotel_id, headers = _bootstrap_hotel(client, f"sync-{suffix}", phone_number_id, "601")

        guest = client.post(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=headers,
            json={
                "name": "Phone Fix Guest",
                "phone": old_guest_phone,
                "whatsapp_phone": old_guest_phone,
                "status": "checked_in",
            },
        )
        assert guest.status_code == 200
        guest_id = guest.json()["data"]["id"]

        conversation = client.get(
            f"/api/v1/hotels/{hotel_id}/guests/{guest_id}/conversation",
            headers=headers,
        )
        assert conversation.status_code == 200
        conversation_id = conversation.json()["data"]["conversation_id"]

        before = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=headers,
        )
        assert before.status_code == 200
        assert before.json()["data"][0]["phone"] == old_guest_phone

        update = client.patch(
            f"/api/v1/hotels/{hotel_id}/guests/{guest_id}",
            headers=headers,
            json={"whatsapp_phone": corrected_guest_phone},
        )
        assert update.status_code == 200
        assert update.json()["data"]["whatsapp_phone"] == corrected_guest_phone

        after = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=headers,
        )
        assert after.status_code == 200
        assert after.json()["data"][0]["phone"] == corrected_guest_phone

        send = client.post(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations/{conversation_id}/messages",
            headers=headers,
            json={"message": "Hello again"},
        )
        assert send.status_code == 200
        assert send.json()["data"]["result"]["payload"]["to"] == corrected_guest_phone


def test_whatsapp_service_uses_account_access_token_when_not_dry_run(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict = {}

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict:
            return {"messages": [{"id": "wamid.outbound"}]}

    def fake_post(url: str, json: dict, headers: dict, timeout: int) -> FakeResponse:
        captured.update(
            {
                "url": url,
                "json": json,
                "headers": headers,
                "timeout": timeout,
            }
        )
        return FakeResponse()

    monkeypatch.setattr(whatsapp_service.settings, "whatsapp_dry_run", False)
    monkeypatch.setattr(whatsapp_service.httpx, "post", fake_post)

    result = WhatsAppService().send_text(
        "phone_account_a",
        "919999999999",
        "Hello from hotel A",
        access_token="hotel-a-token",
    )

    assert result == {"messages": [{"id": "wamid.outbound"}]}
    assert captured["url"].endswith("/phone_account_a/messages")
    assert captured["headers"] == {"Authorization": "Bearer hotel-a-token"}
    assert captured["json"]["to"] == "919999999999"
    assert captured["json"]["text"]["body"] == "Hello from hotel A"

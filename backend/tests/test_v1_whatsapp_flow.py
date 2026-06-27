from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


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
        assert "not mapped" in webhook.json()["detail"]

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

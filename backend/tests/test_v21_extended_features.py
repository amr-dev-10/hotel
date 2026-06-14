from datetime import UTC, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _meta_payload(
    phone_number_id: str,
    from_phone: str,
    text: str | None = None,
    interactive_id: str | None = None,
) -> dict:
    message: dict = {"from": from_phone}
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


def _bootstrap(client: TestClient) -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    phone_number_id = f"v21_phone_{suffix}"
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"v21-hotel-{suffix}",
            "name": "Arcadia V21 Hotel",
            "owner_name": "V21 Owner",
            "owner_email": f"v21-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "contact_phone": "+919000022222",
            "whatsapp_phone_number_id": phone_number_id,
            "seed_rooms": ["501"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["access_token"], phone_number_id


def test_v21_extended_endpoints_and_dynamic_service_form() -> None:
    with TestClient(app) as client:
        hotel_id, token, phone_number_id = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}

        role = client.post(
            f"/api/v1/hotels/{hotel_id}/roles",
            headers=headers,
            json={"name": "Media Clerk", "permission_codes": ["media.upload"]},
        )
        assert role.status_code == 200
        role_id = role.json()["data"]["id"]
        updated_role = client.put(
            f"/api/v1/hotels/{hotel_id}/roles/{role_id}",
            headers=headers,
            json={"description": "Uploads and deletes files", "permission_codes": ["media.upload", "media.delete"]},
        )
        assert updated_role.status_code == 200
        deleted_role = client.delete(f"/api/v1/hotels/{hotel_id}/roles/{role_id}", headers=headers)
        assert deleted_role.status_code == 200

        config = client.get(f"/api/v1/hotels/{hotel_id}/bot-config", headers=headers)
        assert config.status_code == 200
        config_data = config.json()["data"]
        config_data["messages"]["main_menu"] = "Changed menu text"
        put_config = client.put(f"/api/v1/hotels/{hotel_id}/bot-config", headers=headers, json=config_data)
        assert put_config.status_code == 200
        versions = client.get(f"/api/v1/hotels/{hotel_id}/bot-config/versions", headers=headers)
        assert versions.status_code == 200
        rollback_version = versions.json()["data"][-1]["version"]
        rollback = client.post(
            f"/api/v1/hotels/{hotel_id}/bot-config/rollback",
            headers=headers,
            params={"version": rollback_version},
        )
        assert rollback.status_code == 200

        form = client.post(
            f"/api/v1/hotels/{hotel_id}/service-forms",
            headers=headers,
            json={
                "service_name": "Taxi/Cab Request",
                "service_id": "taxi_cab",
                "fields": [
                    {"field_name": "pickup_time", "label": "Pickup time", "required": True},
                    {"field_name": "passengers", "label": "Number of passengers", "field_type": "number", "required": True},
                ],
            },
        )
        assert form.status_code == 200
        form_id = form.json()["data"]["id"]
        assert client.put(
            f"/api/v1/hotels/{hotel_id}/service-forms/{form_id}",
            headers=headers,
            json={"service_name": "Taxi/Cab Request", "service_id": "taxi_cab"},
        ).status_code == 200

        guest_phone = f"9177000{uuid4().hex[:5]}"
        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="Hi")).status_code == 200
        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="Form Guest")).status_code == 200
        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="501")).status_code == 200
        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, interactive_id="main_room_service")).status_code == 200
        prompt = client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, interactive_id="taxi_cab"))
        assert prompt.status_code == 200
        assert "Pickup time" in prompt.json()["data"]["outbound"][0]["reply"]["text"]
        next_prompt = client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="3:30 PM"))
        assert next_prompt.status_code == 200
        assert "Number of passengers" in next_prompt.json()["data"]["outbound"][0]["reply"]["text"]
        created_ticket = client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="2"))
        assert created_ticket.status_code == 200
        assert "Request ID" in created_ticket.json()["data"]["outbound"][0]["reply"]["text"]

        tickets = client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=headers)
        assert tickets.status_code == 200
        assert any("pickup_time: 3:30 PM" in ticket["item_description"] for ticket in tickets.json()["data"])

        campaign = client.post(
            f"/api/v1/hotels/{hotel_id}/campaigns",
            headers=headers,
            json={
                "name": "Late Dinner",
                "template_name": "late_dinner_offer",
                "target_type": "all_active_guests",
                "scheduled_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
                "params": {"offer": "20% off"},
            },
        )
        assert campaign.status_code == 200
        campaign_id = campaign.json()["data"]["id"]
        assert client.post(f"/api/v1/hotels/{hotel_id}/campaigns/{campaign_id}/send", headers=headers).status_code == 200
        stats = client.get(f"/api/v1/hotels/{hotel_id}/campaigns/{campaign_id}/stats", headers=headers)
        assert stats.status_code == 200
        assert stats.json()["data"]["sent_count"] >= 1

        notification = client.post(
            f"/api/v1/hotels/{hotel_id}/notifications",
            headers=headers,
            json={"title": "Shift note", "message": "Lobby is busy", "metadata": {"area": "lobby"}},
        )
        assert notification.status_code == 200
        notification_id = notification.json()["data"]["id"]
        my_notifications = client.get(f"/api/v1/hotels/{hotel_id}/notifications/me", headers=headers)
        assert my_notifications.status_code == 200
        read = client.put(f"/api/v1/hotels/{hotel_id}/notifications/{notification_id}/read", headers=headers)
        assert read.status_code == 200
        assert read.json()["data"]["status"] == "read"

        media = client.post(
            f"/api/v1/hotels/{hotel_id}/media/upload",
            headers=headers,
            json={
                "file_url": "https://cdn.example.com/menu.jpg",
                "file_type": "image",
                "file_name": "menu.jpg",
                "file_size_bytes": 1234,
                "storage_provider": "s3",
            },
        )
        assert media.status_code == 200
        media_id = media.json()["data"]["id"]
        assert client.delete(f"/api/v1/hotels/{hotel_id}/media/{media_id}", headers=headers).status_code == 200

        upgraded = client.post(
            f"/api/v1/hotels/{hotel_id}/subscription/upgrade",
            headers=headers,
            json={"plan": "pro", "billing_cycle": "monthly"},
        )
        assert upgraded.status_code == 200
        assert upgraded.json()["data"]["plan"] == "pro"

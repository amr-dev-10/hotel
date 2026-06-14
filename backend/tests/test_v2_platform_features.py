from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _meta_payload(phone_number_id: str, from_phone: str, text: str) -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": phone_number_id},
                            "messages": [{"from": from_phone, "type": "text", "text": {"body": text}}],
                        }
                    }
                ]
            }
        ]
    }


def test_v2_rbac_reservations_faq_and_whatsapp_history() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"v2_phone_{suffix}"
    guest_phone = f"9180000{suffix[:5]}"

    with TestClient(app) as client:
        bootstrap = client.post(
            "/api/v1/hotels/bootstrap",
            json={
                "slug": f"v2-hotel-{suffix}",
                "name": "Arcadia V2 Hotel",
                "owner_name": "V2 Owner",
                "owner_email": f"v2-owner-{suffix}@example.com",
                "owner_password": "secretpass123",
                "contact_phone": "+919000011111",
                "whatsapp_phone_number_id": phone_number_id,
                "seed_rooms": ["301", "302"],
            },
        )
        assert bootstrap.status_code == 200
        data = bootstrap.json()["data"]
        hotel_id = data["hotel"]["id"]
        owner_headers = {"Authorization": f"Bearer {data['access_token']}"}

        accounts = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/accounts",
            headers=owner_headers,
        )
        assert accounts.status_code == 200
        assert accounts.json()["data"][0]["phone_number_id"] == phone_number_id

        permissions = client.get(
            f"/api/v1/hotels/{hotel_id}/roles/permissions",
            headers=owner_headers,
        )
        assert permissions.status_code == 200
        assert any(item["code"] == "reservation.manage" for item in permissions.json()["data"])

        role = client.post(
            f"/api/v1/hotels/{hotel_id}/roles",
            headers=owner_headers,
            json={
                "name": "Ticket Viewer",
                "description": "Can only view tickets",
                "permission_codes": ["ticket.view"],
            },
        )
        assert role.status_code == 200
        role_id = role.json()["data"]["id"]

        user = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=owner_headers,
            json={
                "name": "Limited Staff",
                "email": f"staff-{suffix}@example.com",
                "password": "secretpass123",
                "job_role": "Viewer",
            },
        )
        assert user.status_code == 200
        user_id = user.json()["data"]["id"]

        assigned = client.post(
            f"/api/v1/hotels/{hotel_id}/roles/users/{user_id}",
            headers=owner_headers,
            json={"role_ids": [role_id]},
        )
        assert assigned.status_code == 200

        staff_login = client.post(
            "/api/v1/auth/login",
            json={
                "email": f"staff-{suffix}@example.com",
                "password": "secretpass123",
            },
        )
        assert staff_login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {staff_login.json()['data']['access_token']}"}
        assert client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=staff_headers).status_code == 200
        assert client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=staff_headers).status_code == 403

        rooms = client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=owner_headers)
        room_id = rooms.json()["data"][0]["id"]
        reservation = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=owner_headers,
            json={
                "guest_name": "Reservation Guest",
                "phone": "+919999900000",
                "room_id": room_id,
                "checkin_date": date.today().isoformat(),
                "checkout_date": (date.today() + timedelta(days=1)).isoformat(),
                "source": "direct",
            },
        )
        assert reservation.status_code == 200
        reservation_id = reservation.json()["data"]["id"]
        checked_in = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-in",
            headers=owner_headers,
        )
        assert checked_in.status_code == 200
        assert checked_in.json()["data"]["status"] == "checked_in"
        checked_out = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-out",
            headers=owner_headers,
        )
        assert checked_out.status_code == 200
        assert checked_out.json()["data"]["status"] == "checked_out"

        faq = client.post(
            f"/api/v1/hotels/{hotel_id}/knowledge/faqs",
            headers=owner_headers,
            json={
                "question": "What time is breakfast?",
                "answer": "Breakfast is available from 7 AM to 10 AM.",
                "category": "dining",
            },
        )
        assert faq.status_code == 200

        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, "Hi")).status_code == 200
        assert client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, "FAQ Guest"),
        ).status_code == 200
        assert client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, "302"),
        ).status_code == 200
        faq_reply = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, "what time breakfast"),
        )
        assert faq_reply.status_code == 200
        assert "7 AM to 10 AM" in faq_reply.json()["data"]["outbound"][0]["reply"]["text"]

        conversations = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations",
            headers=owner_headers,
        )
        assert conversations.status_code == 200
        assert len(conversations.json()["data"]) == 1
        conversation_id = conversations.json()["data"][0]["id"]
        messages = client.get(
            f"/api/v1/hotels/{hotel_id}/whatsapp/conversations/{conversation_id}/messages",
            headers=owner_headers,
        )
        assert messages.status_code == 200
        assert len(messages.json()["data"]) >= 6

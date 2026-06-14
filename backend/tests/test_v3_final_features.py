from datetime import date, timedelta
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


def test_v3_final_architecture_features() -> None:
    suffix = uuid4().hex[:8]
    phone_number_id = f"v3_phone_{suffix}"
    guest_phone = f"9193333{suffix[:5]}"

    with TestClient(app) as client:
        bootstrap = client.post(
            "/api/v1/hotels/bootstrap",
            json={
                "slug": f"v3-hotel-{suffix}",
                "name": "Arcadia V3 Hotel",
                "owner_name": "V3 Owner",
                "owner_email": f"v3-owner-{suffix}@example.com",
                "owner_password": "secretpass123",
                "contact_phone": "+919000033333",
                "whatsapp_phone_number_id": phone_number_id,
                "seed_rooms": ["801", "802"],
            },
        )
        assert bootstrap.status_code == 200
        bootstrap_data = bootstrap.json()["data"]
        hotel_id = bootstrap_data["hotel"]["id"]
        token = bootstrap_data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        refresh = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": bootstrap_data["refresh_token"]},
        )
        assert refresh.status_code == 200
        assert refresh.json()["data"]["access_token"]
        assert refresh.json()["data"]["refresh_token"]

        groups = client.get(f"/api/v1/hotels/{hotel_id}/roles/permission-groups", headers=headers)
        assert groups.status_code == 200
        assert any(group["module"] == "financial" for group in groups.json()["data"])

        room_types = client.get(f"/api/v1/hotels/{hotel_id}/room-types", headers=headers)
        assert room_types.status_code == 200
        default_room_type_id = room_types.json()["data"][0]["id"]
        deluxe = client.post(
            f"/api/v1/hotels/{hotel_id}/room-types",
            headers=headers,
            json={
                "name": "Deluxe",
                "max_occupancy": 3,
                "base_price": "5000.00",
                "amenities": ["AC", "TV", "WiFi"],
            },
        )
        assert deluxe.status_code == 200
        deluxe_type_id = deluxe.json()["data"]["id"]
        assert client.put(
            f"/api/v1/hotels/{hotel_id}/room-types/{deluxe_type_id}",
            headers=headers,
            json={"sort_order": 20},
        ).status_code == 200

        rate_plan = client.post(
            f"/api/v1/hotels/{hotel_id}/rate-plans",
            headers=headers,
            json={
                "name": "Deluxe B&B",
                "room_type_id": deluxe_type_id,
                "base_price": "6500.00",
                "includes": ["breakfast", "wifi"],
                "is_default": True,
            },
        )
        assert rate_plan.status_code == 200
        rate_plan_id = rate_plan.json()["data"]["id"]
        period = client.post(
            f"/api/v1/hotels/{hotel_id}/rate-plans/{rate_plan_id}/periods",
            headers=headers,
            json={
                "name": "Weekend",
                "multiplier": "1.25",
                "day_of_week": ["fri", "sat"],
            },
        )
        assert period.status_code == 200

        rooms = client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=headers)
        assert rooms.status_code == 200
        room_801_id = next(room["id"] for room in rooms.json()["data"] if room["room_number"] == "801")
        room_802_id = next(room["id"] for room in rooms.json()["data"] if room["room_number"] == "802")
        created_room = client.post(
            f"/api/v1/hotels/{hotel_id}/rooms",
            headers=headers,
            json={
                "room_number": "901",
                "room_type_id": deluxe_type_id,
                "floor": "9",
            },
        )
        assert created_room.status_code == 200

        reservation = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=headers,
            json={
                "guest_name": "V3 Reservation Guest",
                "phone": "+919999933333",
                "room_id": room_801_id,
                "rate_plan_id": rate_plan_id,
                "checkin_date": date.today().isoformat(),
                "checkout_date": (date.today() + timedelta(days=1)).isoformat(),
                "source": "direct",
            },
        )
        assert reservation.status_code == 200
        reservation_id = reservation.json()["data"]["id"]
        check_in = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-in",
            headers=headers,
        )
        assert check_in.status_code == 200
        folios = client.get(f"/api/v1/hotels/{hotel_id}/folios", headers=headers)
        assert folios.status_code == 200
        folio_id = folios.json()["data"][0]["id"]

        item = client.post(
            f"/api/v1/hotels/{hotel_id}/folios/{folio_id}/items",
            headers=headers,
            json={
                "item_type": "minibar",
                "description": "Minibar snacks",
                "quantity": 2,
                "unit_price": "250.00",
            },
        )
        assert item.status_code == 200
        payment = client.post(
            f"/api/v1/hotels/{hotel_id}/folios/{folio_id}/payments",
            headers=headers,
            json={"amount": "500.00", "payment_method": "upi", "reference_no": "UPI123"},
        )
        assert payment.status_code == 200
        refund = client.post(
            f"/api/v1/hotels/{hotel_id}/folios/{folio_id}/refunds",
            headers=headers,
            json={
                "payment_id": payment.json()["data"]["id"],
                "amount": "100.00",
                "reason": "Guest dispute",
            },
        )
        assert refund.status_code == 200
        tax = client.post(
            f"/api/v1/hotels/{hotel_id}/tax-configs",
            headers=headers,
            json={"name": "GST 12", "rate_percent": "12.00", "applies_to": "room"},
        )
        assert tax.status_code == 200

        changed = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/change-room",
            headers=headers,
            json={"new_room_id": room_802_id, "reason": "Upgrade after AC issue"},
        )
        assert changed.status_code == 200
        stays = client.get(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/stays",
            headers=headers,
        )
        assert stays.status_code == 200
        assert len(stays.json()["data"]) == 2
        guests = client.get(f"/api/v1/hotels/{hotel_id}/guests", headers=headers)
        assert "room_id" not in guests.json()["data"][0]

        checkout = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-out",
            headers=headers,
        )
        assert checkout.status_code == 200
        housekeeping = client.get(f"/api/v1/hotels/{hotel_id}/housekeeping", headers=headers)
        assert housekeeping.status_code == 200
        assert any(task["task_type"] == "checkout_clean" for task in housekeeping.json()["data"])

        engineering_ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "room_id": room_802_id,
                "department_key": "engineering",
                "item_description": "AC is leaking",
                "priority": 3,
            },
        )
        assert engineering_ticket.status_code == 200
        maintenance = client.get(f"/api/v1/hotels/{hotel_id}/maintenance", headers=headers)
        assert maintenance.status_code == 200
        assert any(order["ticket_id"] == engineering_ticket.json()["data"]["id"] for order in maintenance.json()["data"])

        lost_found = client.post(
            f"/api/v1/hotels/{hotel_id}/lost-found",
            headers=headers,
            json={
                "type": "found",
                "item_description": "Black laptop bag",
                "found_location": "Lobby",
                "found_date": date.today().isoformat(),
            },
        )
        assert lost_found.status_code == 200
        assert client.put(
            f"/api/v1/hotels/{hotel_id}/lost-found/{lost_found.json()['data']['id']}",
            headers=headers,
            json={"status": "claimed"},
        ).status_code == 200

        knowledge = client.post(
            f"/api/v1/hotels/{hotel_id}/knowledge",
            headers=headers,
            json={
                "title": "Pool Rules",
                "category": "amenities",
                "content": "The outdoor pool is heated to 28C year-round. Pool closes at 9 PM and last entry is 8:30 PM.",
            },
        )
        assert knowledge.status_code == 200

        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="Hi")).status_code == 200
        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="V3 Guest")).status_code == 200
        assert client.post("/webhook/whatsapp", json=_meta_payload(phone_number_id, guest_phone, text="802")).status_code == 200
        rag_reply = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, text="is pool heated and when close"),
        )
        assert rag_reply.status_code == 200
        assert "heated to 28C" in rag_reply.json()["data"]["outbound"][0]["reply"]["text"]

        live = client.post(
            "/webhook/whatsapp",
            json=_meta_payload(phone_number_id, guest_phone, interactive_id="main_manager"),
        )
        assert live.status_code == 200
        live_sessions = client.get(f"/api/v1/hotels/{hotel_id}/live-chat/sessions", headers=headers)
        assert live_sessions.status_code == 200
        live_chat_id = live_sessions.json()["data"][0]["id"]
        assert client.post(f"/api/v1/hotels/{hotel_id}/live-chat/{live_chat_id}/accept", headers=headers).status_code == 200
        assert client.post(
            f"/api/v1/hotels/{hotel_id}/live-chat/{live_chat_id}/send",
            headers=headers,
            json={"message": "Reception will call you now."},
        ).status_code == 200
        assert client.post(f"/api/v1/hotels/{hotel_id}/live-chat/{live_chat_id}/end", headers=headers).status_code == 200

        health = client.get(f"/api/v1/hotels/{hotel_id}/whatsapp/health", headers=headers)
        assert health.status_code == 200
        assert health.json()["data"][0]["webhook_status"] == "active"
        usage = client.get(f"/api/v1/hotels/{hotel_id}/whatsapp/usage", headers=headers)
        assert usage.status_code == 200
        assert usage.json()["data"]["messages_received"] >= 4

        organization = client.post(
            "/api/v1/orgs",
            headers=headers,
            json={
                "name": f"Arcadia Chain {suffix}",
                "slug": f"arcadia-chain-{suffix}",
                "contact_email": f"chain-{suffix}@example.com",
            },
        )
        assert organization.status_code == 200
        organization_id = organization.json()["data"]["id"]
        org_hotels = client.get(f"/api/v1/orgs/{organization_id}/hotels", headers=headers)
        assert org_hotels.status_code == 200
        assert org_hotels.json()["data"][0]["hotel_id"] == hotel_id
        org_analytics = client.get(f"/api/v1/orgs/{organization_id}/analytics", headers=headers)
        assert org_analytics.status_code == 200
        assert org_analytics.json()["data"]["hotel_count"] == 1

        analytics = client.get(
            f"/api/v1/hotels/{hotel_id}/analytics",
            headers=headers,
            params={"from": date.today().isoformat(), "to": date.today().isoformat()},
        )
        assert analytics.status_code == 200
        assert analytics.json()["data"][0]["total_rooms"] >= 3

        with client.websocket_connect(f"/ws/tickets?token={token}") as websocket:
            connected = websocket.receive_json()
            assert connected["topic"] == "tickets"

        logout_all = client.post("/api/v1/auth/logout-all", headers=headers)
        assert logout_all.status_code == 200

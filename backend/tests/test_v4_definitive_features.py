from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _bootstrap(client: TestClient) -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    phone_number_id = f"v4_phone_{suffix}"
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"v4-hotel-{suffix}",
            "name": "Arcadia V4 Hotel",
            "owner_name": "V4 Owner",
            "owner_email": f"v4-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "contact_phone": "+919000044444",
            "whatsapp_phone_number_id": phone_number_id,
            "seed_rooms": ["1001", "1002"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["access_token"], phone_number_id


def test_v4_definitive_backend_flows() -> None:
    with TestClient(app) as client:
        hotel_id, token, phone_number_id = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}

        rooms = client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=headers)
        assert rooms.status_code == 200
        room_id = rooms.json()["data"][0]["id"]

        departments = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=headers)
        assert departments.status_code == 200
        department_by_key = {item["key"]: item["id"] for item in departments.json()["data"]}

        food_staff = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "Food Runner",
                "email": f"food-{uuid4().hex[:8]}@example.com",
                "password": "secretpass123",
                "department_id": department_by_key["food_beverage"],
                "job_role": "Runner",
                "is_on_duty": False,
            },
        )
        assert food_staff.status_code == 200
        food_staff_id = food_staff.json()["data"]["id"]

        shift = client.post(
            f"/api/v1/hotels/{hotel_id}/shifts",
            headers=headers,
            json={
                "user_id": food_staff_id,
                "department_id": department_by_key["food_beverage"],
                "shift_date": date.today().isoformat(),
                "shift_start": "00:00:00",
                "shift_end": "23:59:00",
                "shift_type": "day",
                "status": "checked_in",
            },
        )
        assert shift.status_code == 200

        vendor = client.post(
            f"/api/v1/hotels/{hotel_id}/inventory/vendors",
            headers=headers,
            json={"name": "Linen Supplier", "category": "housekeeping"},
        )
        assert vendor.status_code == 200
        vendor_id = vendor.json()["data"]["id"]
        inventory_item = client.post(
            f"/api/v1/hotels/{hotel_id}/inventory/items",
            headers=headers,
            json={
                "name": "Bath Towel",
                "category": "housekeeping",
                "unit": "piece",
                "min_stock": 5,
                "current_stock": 5,
                "cost_per_unit": "80.00",
                "default_vendor_id": vendor_id,
            },
        )
        assert inventory_item.status_code == 200
        towel_id = inventory_item.json()["data"]["id"]

        purchase_order = client.post(
            f"/api/v1/hotels/{hotel_id}/inventory/purchase-orders",
            headers=headers,
            json={
                "vendor_id": vendor_id,
                "items": [{"item_id": towel_id, "quantity": 4, "unit_price": "75.00"}],
            },
        )
        assert purchase_order.status_code == 200
        received = client.post(
            f"/api/v1/hotels/{hotel_id}/inventory/purchase-orders/{purchase_order.json()['data']['id']}/receive",
            headers=headers,
        )
        assert received.status_code == 200
        assert received.json()["data"]["status"] == "received"

        checklist = client.put(
            f"/api/v1/hotels/{hotel_id}/housekeeping/checklists/checkout_clean",
            headers=headers,
            json={"task_type": "checkout_clean", "items": [{"name": "Bath Towel", "quantity": 2}]},
        )
        assert checklist.status_code == 200
        housekeeping = client.post(
            f"/api/v1/hotels/{hotel_id}/housekeeping",
            headers=headers,
            json={
                "room_id": room_id,
                "task_type": "checkout_clean",
                "scheduled_date": date.today().isoformat(),
            },
        )
        assert housekeeping.status_code == 200
        completed = client.put(
            f"/api/v1/hotels/{hotel_id}/housekeeping/{housekeeping.json()['data']['id']}",
            headers=headers,
            json={"status": "completed"},
        )
        assert completed.status_code == 200
        transactions = client.get(f"/api/v1/hotels/{hotel_id}/inventory/transactions", headers=headers)
        assert transactions.status_code == 200
        assert any(item["reference_type"] == "housekeeping_task" for item in transactions.json()["data"])

        guest_a = client.post(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=headers,
            json={"name": "Primary Guest", "phone": "+919100000001", "status": "pre_arrival"},
        )
        guest_b = client.post(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=headers,
            json={"name": "Spouse Guest", "phone": "+919100000002", "status": "pre_arrival"},
        )
        assert guest_a.status_code == 200
        assert guest_b.status_code == 200
        guest_a_id = guest_a.json()["data"]["id"]
        guest_b_id = guest_b.json()["data"]["id"]

        reservation = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=headers,
            json={
                "room_id": room_id,
                "checkin_date": date.today().isoformat(),
                "checkout_date": (date.today() + timedelta(days=1)).isoformat(),
                "source": "direct",
                "guests": [
                    {"guest_id": guest_a_id, "is_primary": True, "relationship": "self"},
                    {"guest_id": guest_b_id, "relationship": "spouse"},
                ],
            },
        )
        assert reservation.status_code == 200
        reservation_id = reservation.json()["data"]["id"]
        reservation_guests = client.get(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/guests",
            headers=headers,
        )
        assert reservation_guests.status_code == 200
        assert len(reservation_guests.json()["data"]) == 2
        assert any(item["is_primary"] for item in reservation_guests.json()["data"])

        added_guest = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/guests",
            headers=headers,
            json={"name": "Child Guest", "relationship": "child"},
        )
        assert added_guest.status_code == 200

        checkin = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations/{reservation_id}/check-in",
            headers=headers,
        )
        assert checkin.status_code == 200
        folios = client.get(f"/api/v1/hotels/{hotel_id}/folios", headers=headers)
        assert folios.status_code == 200
        folio_id = folios.json()["data"][0]["id"]

        category = client.post(
            f"/api/v1/hotels/{hotel_id}/menu/categories",
            headers=headers,
            json={"name": "V4 Dining", "type": "food"},
        )
        assert category.status_code == 200
        menu_item = client.post(
            f"/api/v1/hotels/{hotel_id}/menu/items",
            headers=headers,
            json={
                "category_id": category.json()["data"]["id"],
                "name": "Club Sandwich",
                "price": "450.00",
            },
        )
        assert menu_item.status_code == 200
        table = client.post(
            f"/api/v1/hotels/{hotel_id}/restaurant/tables",
            headers=headers,
            json={"table_number": "T1", "section": "Patio", "capacity": 4},
        )
        assert table.status_code == 200
        order = client.post(
            f"/api/v1/hotels/{hotel_id}/restaurant/orders",
            headers=headers,
            json={
                "source": "room_service",
                "table_id": table.json()["data"]["id"],
                "guest_id": guest_a_id,
                "room_id": room_id,
                "folio_id": folio_id,
                "tax": "45.00",
                "items": [{"menu_item_id": menu_item.json()["data"]["id"], "quantity": 2}],
            },
        )
        assert order.status_code == 200
        restaurant_order = order.json()["data"]
        assert restaurant_order["ticket_id"]
        assert float(restaurant_order["total"]) == 945.0
        folio = client.get(f"/api/v1/hotels/{hotel_id}/folios/{folio_id}", headers=headers)
        assert folio.status_code == 200
        assert any(item["item_type"] == "food" for item in folio.json()["data"]["items"])
        tickets = client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=headers)
        assert tickets.status_code == 200
        food_ticket = next(item for item in tickets.json()["data"] if item["id"] == restaurant_order["ticket_id"])
        assert food_ticket["assigned_to"] == food_staff_id

        workflow = client.post(
            f"/api/v1/hotels/{hotel_id}/workflows",
            headers=headers,
            json={
                "name": "Approval Workflow",
                "entity_type": "ticket",
                "is_default": True,
                "states": [
                    {"name": "Open", "state_key": "open", "state_type": "initial", "sort_order": 1},
                    {"name": "Approved", "state_key": "approved", "state_type": "intermediate", "sort_order": 2},
                    {"name": "Completed", "state_key": "completed", "state_type": "terminal", "sort_order": 3},
                ],
                "transitions": [
                    {"from_state_key": "open", "to_state_key": "approved"},
                    {"from_state_key": "approved", "to_state_key": "completed"},
                ],
            },
        )
        assert workflow.status_code == 200
        ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "department_key": "front_office",
                "item_description": "Approve late checkout",
                "priority": 2,
            },
        )
        assert ticket.status_code == 200
        ticket_id = ticket.json()["data"]["id"]
        approved = client.patch(
            f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/stage",
            headers=headers,
            json={"stage": "approved", "note": "Manager approved"},
        )
        assert approved.status_code == 200
        assert approved.json()["data"]["stage"] == "approved"
        completed_ticket = client.patch(
            f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}/stage",
            headers=headers,
            json={"stage": "completed"},
        )
        assert completed_ticket.status_code == 200
        assert completed_ticket.json()["data"]["resolved_at"]

        document = client.post(
            f"/api/v1/hotels/{hotel_id}/knowledge",
            headers=headers,
            json={
                "title": "Spa Hours",
                "category": "amenities",
                "content": "The spa opens at 8 AM and closes at 8 PM.",
                "change_note": "Initial spa hours",
            },
        )
        assert document.status_code == 200
        document_id = document.json()["data"]["id"]
        updated_document = client.put(
            f"/api/v1/hotels/{hotel_id}/knowledge/{document_id}",
            headers=headers,
            json={"content": "The spa opens at 7 AM and closes at 8 PM.", "change_note": "Earlier opening"},
        )
        assert updated_document.status_code == 200
        versions = client.get(
            f"/api/v1/hotels/{hotel_id}/knowledge/{document_id}/versions",
            headers=headers,
        )
        assert versions.status_code == 200
        assert len(versions.json()["data"]) == 2
        rollback = client.post(
            f"/api/v1/hotels/{hotel_id}/knowledge/{document_id}/rollback",
            headers=headers,
            params={"version": 1},
        )
        assert rollback.status_code == 200
        assert "8 AM" in rollback.json()["data"]["content"]

        onboarding = client.post(
            f"/api/v1/hotels/{hotel_id}/whatsapp/onboarding/start",
            headers=headers,
            json={
                "business_name": "Arcadia V4 WhatsApp",
                "phone_number": "+919000055555",
                "phone_number_id": f"v4_onboard_{uuid4().hex[:8]}",
                "waba_id": "waba-v4",
            },
        )
        assert onboarding.status_code == 200
        account_id = onboarding.json()["data"]["id"]
        verified = client.post(
            f"/api/v1/hotels/{hotel_id}/whatsapp/accounts/{account_id}/onboarding/verify",
            headers=headers,
            json={"access_token": "test-access-token"},
        )
        assert verified.status_code == 200
        assert verified.json()["data"]["onboarding_step"] == "test_message"
        test_message = client.post(
            f"/api/v1/hotels/{hotel_id}/whatsapp/accounts/{account_id}/test-message",
            headers=headers,
            json={"to_phone": "+919100000003", "message": "V4 test"},
        )
        assert test_message.status_code == 200
        assert test_message.json()["data"]["account"]["onboarding_step"] == "complete"
        windows = client.get(f"/api/v1/hotels/{hotel_id}/whatsapp/conversation-windows", headers=headers)
        assert windows.status_code == 200
        assert len(windows.json()["data"]) >= 1
        summary = client.get(f"/api/v1/hotels/{hotel_id}/whatsapp/conversation-windows/summary", headers=headers)
        assert summary.status_code == 200
        assert summary.json()["data"]["total_windows"] >= 1

        features = client.get(f"/api/v1/hotels/{hotel_id}/saas/features", headers=headers)
        assert features.status_code == 200
        assert any(item["code"] == "tickets" for item in features.json()["data"])
        usage_limits = client.get(f"/api/v1/hotels/{hotel_id}/saas/usage-limits", headers=headers)
        assert usage_limits.status_code == 200
        assert any(item["feature_code"] == "tickets" and item["used_value"] >= 1 for item in usage_limits.json()["data"])

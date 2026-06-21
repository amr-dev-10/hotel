from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def _bootstrap(client: TestClient) -> tuple[str, dict[str, str]]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"perf-hotel-{suffix}",
            "name": "Arcadia Performance Hotel",
            "owner_name": "Performance Owner",
            "owner_email": f"perf-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "seed_rooms": ["901", "902"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], {"Authorization": f"Bearer {data['access_token']}"}


def _department_id(client: TestClient, hotel_id: str, headers: dict[str, str], key: str) -> str:
    response = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=headers)
    assert response.status_code == 200
    return next(item["id"] for item in response.json()["data"] if item["key"] == key)


def _room_id(client: TestClient, hotel_id: str, headers: dict[str, str], room_number: str) -> str:
    response = client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=headers)
    assert response.status_code == 200
    return next(item["id"] for item in response.json()["data"] if item["room_number"] == room_number)


def _create_staff(
    client: TestClient,
    hotel_id: str,
    headers: dict[str, str],
    department_id: str,
    name: str,
) -> str:
    suffix = uuid4().hex[:8]
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/users",
        headers=headers,
        json={
            "name": name,
            "email": f"{name.lower().replace(' ', '-')}-{suffix}@example.com",
            "password": "secretpass123",
            "department_id": department_id,
            "staff_level": "attendant",
            "job_role": "Attendant",
            "is_on_duty": True,
        },
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def test_guest_list_cursor_metadata_and_server_search() -> None:
    with TestClient(app) as client:
        hotel_id, headers = _bootstrap(client)
        names = ["Performance Alpha", "Performance Beta", "Performance Gamma"]
        for name in names:
            response = client.post(
                f"/api/v1/hotels/{hotel_id}/guests",
                headers=headers,
                json={"name": name, "phone": f"555-{uuid4().hex[:6]}", "status": "checked_in"},
            )
            assert response.status_code == 200

        first_page = client.get(f"/api/v1/hotels/{hotel_id}/guests?limit=2", headers=headers)
        assert first_page.status_code == 200
        assert len(first_page.json()["data"]) == 2
        assert first_page.json()["meta"]["has_more"] is True
        assert first_page.json()["meta"]["next_cursor"]
        assert int(first_page.headers["X-DB-Query-Count"]) >= 1

        second_page = client.get(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=headers,
            params={"limit": 2, "cursor": first_page.json()["meta"]["next_cursor"]},
        )
        assert second_page.status_code == 200
        assert {item["id"] for item in first_page.json()["data"]}.isdisjoint(
            {item["id"] for item in second_page.json()["data"]}
        )

        searched = client.get(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=headers,
            params={"q": "Performance Alpha"},
        )
        assert searched.status_code == 200
        assert [item["name"] for item in searched.json()["data"]] == ["Performance Alpha"]


def test_reservation_list_includes_guest_context_and_ticket_detail_is_direct() -> None:
    with TestClient(app) as client:
        hotel_id, headers = _bootstrap(client)
        tomorrow = date.today() + timedelta(days=1)
        checkout = tomorrow + timedelta(days=2)

        reservation = client.post(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=headers,
            json={
                "guest_name": "Performance Stay Guest",
                "phone": "555-res",
                "checkin_date": tomorrow.isoformat(),
                "checkout_date": checkout.isoformat(),
                "source": "walk_in",
            },
        )
        assert reservation.status_code == 200

        reservations = client.get(
            f"/api/v1/hotels/{hotel_id}/reservations",
            headers=headers,
            params={"q": "Performance Stay Guest"},
        )
        assert reservations.status_code == 200
        assert reservations.json()["data"][0]["guest_name"] == "Performance Stay Guest"
        assert reservations.json()["meta"]["limit"] == 50

        ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "item_description": "Performance faucet leak",
                "source": "DASHBOARD",
                "priority": 4,
            },
        )
        assert ticket.status_code == 200
        ticket_id = ticket.json()["data"]["id"]

        tickets = client.get(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            params={"q": "faucet leak", "limit": 1},
        )
        assert tickets.status_code == 200
        assert tickets.json()["data"][0]["id"] == ticket_id
        assert tickets.json()["meta"]["limit"] == 1

        detail = client.get(f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}", headers=headers)
        assert detail.status_code == 200
        assert detail.json()["data"]["item_description"] == "Performance faucet leak"


def test_ticket_list_labels_and_pending_acceptance_escalation_view() -> None:
    with TestClient(app) as client:
        hotel_id, headers = _bootstrap(client)
        department_id = _department_id(client, hotel_id, headers, "housekeeping")
        room_id = _room_id(client, hotel_id, headers, "901")
        attendant_id = _create_staff(client, hotel_id, headers, department_id, "Performance Attendant")

        ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            json={
                "department_id": department_id,
                "assigned_to": attendant_id,
                "room_id": room_id,
                "task_category": "towel_request",
                "item_description": "Need towel from WhatsApp context",
                "source": "WHATSAPP",
                "priority": 2,
            },
        )
        assert ticket.status_code == 200
        ticket_id = ticket.json()["data"]["id"]
        assert ticket.json()["data"]["assigned_to_name"] == "Performance Attendant"
        assert ticket.json()["data"]["room_number"] == "901"

        tickets = client.get(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=headers,
            params={"q": "towel from WhatsApp"},
        )
        assert tickets.status_code == 200
        row = tickets.json()["data"][0]
        assert row["id"] == ticket_id
        assert row["assigned_to_name"] == "Performance Attendant"
        assert row["room_number"] == "901"

        escalations = client.get(
            f"/api/v1/hotels/{hotel_id}/tickets/escalations",
            headers=headers,
            params={"scope": "all"},
        )
        assert escalations.status_code == 200
        escalation = next(item for item in escalations.json()["data"] if item["ticket_id"] == ticket_id)
        assert escalation["reason"] == "pending_acceptance"
        assert escalation["escalated_to_name"] == "Performance Attendant"
        assert escalation["ticket"]["assigned_to_name"] == "Performance Attendant"
        assert escalation["ticket"]["room_number"] == "901"

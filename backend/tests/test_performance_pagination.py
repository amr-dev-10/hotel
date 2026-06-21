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

from fastapi.testclient import TestClient

from app.main import app


def test_demo_seed_returns_login_credentials_and_dashboard_data() -> None:
    with TestClient(app) as client:
        response = client.post("/api/v1/hotels/demo-seed")

        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["credentials"] == {
            "email": "owner@arcadia.demo",
            "password": "DemoPass123!",
        }

        hotel_id = payload["hotel"]["id"]
        token = payload["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        login = client.post(
            "/api/v1/auth/login",
            json={"email": "owner@arcadia.demo", "password": "DemoPass123!"},
        )
        assert login.status_code == 200

        assert client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=headers).json()["data"]
        assert client.get(f"/api/v1/hotels/{hotel_id}/reservations", headers=headers).json()["data"]
        assert client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=headers).json()["data"]
        assert client.get(f"/api/v1/hotels/{hotel_id}/housekeeping", headers=headers).json()["data"]
        assert client.get(f"/api/v1/hotels/{hotel_id}/analytics", headers=headers).json()["data"]


def test_demo_seed_is_idempotent() -> None:
    with TestClient(app) as client:
        first = client.post("/api/v1/hotels/demo-seed")
        second = client.post("/api/v1/hotels/demo-seed")

        assert first.status_code == 200
        assert second.status_code == 200
        assert first.json()["data"]["hotel"]["id"] == second.json()["data"]["hotel"]["id"]

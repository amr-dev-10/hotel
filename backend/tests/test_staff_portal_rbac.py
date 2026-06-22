from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.security import decode_access_token
from app.main import app


def _bootstrap(client: TestClient) -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"staff-rbac-{suffix}",
            "name": "Staff RBAC Hotel",
            "owner_name": "Staff Owner",
            "owner_email": f"staff-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "seed_rooms": ["9101", "9102"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["owner"]["id"], data["access_token"]


def _create_user(
    client: TestClient,
    hotel_id: str,
    headers: dict[str, str],
    name: str,
    email: str,
    department_id: str | None = None,
) -> str:
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/users",
        headers=headers,
        json={
            "name": name,
            "email": email,
            "password": "secretpass123",
            "department_id": department_id,
            "staff_level": "attendant",
            "job_role": "Attendant",
            "is_on_duty": True,
        },
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def _create_role(client: TestClient, hotel_id: str, headers: dict[str, str], permissions: list[str]) -> str:
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/roles",
        headers=headers,
        json={"name": f"Role {uuid4().hex[:8]}", "permission_codes": permissions},
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def _assign_roles(client: TestClient, hotel_id: str, headers: dict[str, str], user_id: str, role_ids: list[str]) -> None:
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/roles/users/{user_id}",
        headers=headers,
        json={"role_ids": role_ids},
    )
    assert response.status_code == 200


def test_auth_me_is_live_permission_source_and_token_omits_permissions() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        user_id = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Scoped Staff",
            f"scoped-{suffix}@example.com",
        )
        role_id = _create_role(client, hotel_id, owner_headers, ["ticket.view_own"])
        _assign_roles(client, hotel_id, owner_headers, user_id, [role_id])

        login = client.post("/api/v1/auth/login", json={"email": f"scoped-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        token = login.json()["data"]["access_token"]
        token_payload = decode_access_token(token)
        assert "permissions" not in token_payload

        staff_headers = {"Authorization": f"Bearer {token}"}
        me = client.get("/api/v1/auth/me", headers=staff_headers)
        assert me.status_code == 200
        assert "ticket.view_own" in me.json()["data"]["permissions"]

        _assign_roles(client, hotel_id, owner_headers, user_id, [])
        refreshed_me = client.get("/api/v1/auth/me", headers=staff_headers)
        assert refreshed_me.status_code == 200
        assert "ticket.view_own" not in refreshed_me.json()["data"]["permissions"]


def test_ticket_view_own_only_returns_assigned_tickets() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        staff_a = _create_user(client, hotel_id, owner_headers, "Staff A", f"a-{suffix}@example.com")
        staff_b = _create_user(client, hotel_id, owner_headers, "Staff B", f"b-{suffix}@example.com")
        role_id = _create_role(client, hotel_id, owner_headers, ["ticket.view_own", "ticket.accept", "ticket.reject"])
        _assign_roles(client, hotel_id, owner_headers, staff_a, [role_id])

        first = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={"assigned_to": staff_a, "item_description": "Assigned to A", "priority": 2},
        )
        assert first.status_code == 200
        first_id = first.json()["data"]["id"]
        second = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={"assigned_to": staff_b, "item_description": "Assigned to B", "priority": 2},
        )
        assert second.status_code == 200
        second_id = second.json()["data"]["id"]

        login = client.post("/api/v1/auth/login", json={"email": f"a-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        tickets = client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=staff_headers)
        assert tickets.status_code == 200
        visible_ids = {item["id"] for item in tickets.json()["data"]}
        assert first_id in visible_ids
        assert second_id not in visible_ids

        other_detail = client.get(f"/api/v1/hotels/{hotel_id}/tickets/{second_id}", headers=staff_headers)
        assert other_detail.status_code == 403

        other_accept = client.post(f"/api/v1/hotels/{hotel_id}/tickets/{second_id}/accept", headers=staff_headers)
        assert other_accept.status_code == 403

        other_reject = client.post(f"/api/v1/hotels/{hotel_id}/tickets/{second_id}/reject", headers=staff_headers)
        assert other_reject.status_code == 403


def test_staff_can_read_and_update_only_own_shift() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        staff_a = _create_user(client, hotel_id, owner_headers, "Shift A", f"shift-a-{suffix}@example.com")
        staff_b = _create_user(client, hotel_id, owner_headers, "Shift B", f"shift-b-{suffix}@example.com")
        role_id = _create_role(client, hotel_id, owner_headers, ["shift.view_own", "shift.update_own"])
        _assign_roles(client, hotel_id, owner_headers, staff_a, [role_id])

        shift_a = client.post(
            f"/api/v1/hotels/{hotel_id}/shifts",
            headers=owner_headers,
            json={
                "user_id": staff_a,
                "shift_date": "2026-06-22",
                "shift_start": "09:00:00",
                "shift_end": "17:00:00",
                "shift_type": "morning",
                "status": "scheduled",
            },
        )
        assert shift_a.status_code == 200
        shift_a_id = shift_a.json()["data"]["id"]
        shift_b = client.post(
            f"/api/v1/hotels/{hotel_id}/shifts",
            headers=owner_headers,
            json={
                "user_id": staff_b,
                "shift_date": "2026-06-22",
                "shift_start": "09:00:00",
                "shift_end": "17:00:00",
                "shift_type": "morning",
                "status": "scheduled",
            },
        )
        assert shift_b.status_code == 200
        shift_b_id = shift_b.json()["data"]["id"]

        login = client.post("/api/v1/auth/login", json={"email": f"shift-a-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        shifts = client.get(f"/api/v1/hotels/{hotel_id}/shifts", headers=staff_headers)
        assert shifts.status_code == 200
        visible_ids = {item["id"] for item in shifts.json()["data"]}
        assert visible_ids == {shift_a_id}

        own_update = client.patch(
            f"/api/v1/hotels/{hotel_id}/shifts/{shift_a_id}",
            headers=staff_headers,
            json={"status": "checked_in"},
        )
        assert own_update.status_code == 200
        assert own_update.json()["data"]["status"] == "checked_in"

        other_update = client.patch(
            f"/api/v1/hotels/{hotel_id}/shifts/{shift_b_id}",
            headers=staff_headers,
            json={"status": "checked_in"},
        )
        assert other_update.status_code == 403

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
    staff_level: str = "attendant",
) -> str:
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/users",
        headers=headers,
        json={
            "name": name,
            "email": email,
            "password": "secretpass123",
            "department_id": department_id,
            "staff_level": staff_level,
            "job_role": staff_level.title(),
            "is_on_duty": True,
        },
    )
    assert response.status_code == 200
    return response.json()["data"]["id"]


def _create_role(
    client: TestClient,
    hotel_id: str,
    headers: dict[str, str],
    permissions: list[str],
    permission_scopes: dict[str, str] | None = None,
) -> str:
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/roles",
        headers=headers,
        json={
            "name": f"Role {uuid4().hex[:8]}",
            "permission_codes": permissions,
            "permission_scopes": permission_scopes or {},
        },
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


def _department_ids(client: TestClient, hotel_id: str, headers: dict[str, str]) -> dict[str, str]:
    response = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=headers)
    assert response.status_code == 200
    return {item["key"]: item["id"] for item in response.json()["data"]}


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


def test_scoped_ticket_view_base_permission_limits_visibility() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        staff_a = _create_user(client, hotel_id, owner_headers, "Scoped Ticket A", f"ticket-a-{suffix}@example.com")
        staff_b = _create_user(client, hotel_id, owner_headers, "Scoped Ticket B", f"ticket-b-{suffix}@example.com")
        role_id = _create_role(
            client,
            hotel_id,
            owner_headers,
            ["ticket.view", "ticket.accept", "ticket.reject"],
            {"ticket.view": "own"},
        )
        _assign_roles(client, hotel_id, owner_headers, staff_a, [role_id])

        first = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={"assigned_to": staff_a, "item_description": "Assigned scoped base", "priority": 2},
        )
        assert first.status_code == 200
        second = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={"assigned_to": staff_b, "item_description": "Hidden scoped base", "priority": 2},
        )
        assert second.status_code == 200

        login = client.post("/api/v1/auth/login", json={"email": f"ticket-a-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        me = client.get("/api/v1/auth/me", headers=staff_headers)
        assert me.status_code == 200
        assert me.json()["data"]["permission_scopes"]["ticket.view"] == "own"
        assert "ticket.view_own" in me.json()["data"]["permissions"]

        tickets = client.get(f"/api/v1/hotels/{hotel_id}/tickets", headers=staff_headers)
        assert tickets.status_code == 200
        visible_ids = {item["id"] for item in tickets.json()["data"]}
        assert first.json()["data"]["id"] in visible_ids
        assert second.json()["data"]["id"] not in visible_ids


def test_ticket_only_role_reads_ticket_context_without_module_access() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        staff_id = _create_user(client, hotel_id, owner_headers, "Ticket Only", f"ticket-only-{suffix}@example.com")
        guest = client.post(
            f"/api/v1/hotels/{hotel_id}/guests",
            headers=owner_headers,
            json={"name": "Ticket Guest", "phone": "+15550101010", "status": "in_house"},
        )
        assert guest.status_code == 200
        rooms = client.get(f"/api/v1/hotels/{hotel_id}/rooms", headers=owner_headers)
        assert rooms.status_code == 200
        room_id = rooms.json()["data"][0]["id"]
        role_id = _create_role(
            client,
            hotel_id,
            owner_headers,
            [
                "ticket.view",
                "ticket.create",
                "ticket.update",
                "ticket.delete",
                "ticket.assign_self",
                "ticket.assign_others",
            ],
        )
        _assign_roles(client, hotel_id, owner_headers, staff_id, [role_id])

        ticket = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={
                "assigned_to": staff_id,
                "guest_id": guest.json()["data"]["id"],
                "room_id": room_id,
                "item_description": "Ticket context only",
                "priority": 2,
            },
        )
        assert ticket.status_code == 200
        ticket_id = ticket.json()["data"]["id"]

        login = client.post(
            "/api/v1/auth/login",
            json={"email": f"ticket-only-{suffix}@example.com", "password": "secretpass123"},
        )
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        departments = client.get(f"/api/v1/hotels/{hotel_id}/departments", headers=staff_headers)
        assert departments.status_code == 200

        detail = client.get(f"/api/v1/hotels/{hotel_id}/tickets/{ticket_id}", headers=staff_headers)
        assert detail.status_code == 200
        payload = detail.json()["data"]
        assert payload["assigned_to_name"] == "Ticket Only"
        assert payload["guest_name"] == "Ticket Guest"
        assert payload["room_number"] == "9101"

        users = client.get(f"/api/v1/hotels/{hotel_id}/users", headers=staff_headers)
        assert users.status_code == 403
        guests = client.get(f"/api/v1/hotels/{hotel_id}/guests", headers=staff_headers)
        assert guests.status_code == 403
        settings = client.get(f"/api/v1/hotels/{hotel_id}/audit-logs", headers=staff_headers)
        assert settings.status_code == 403


def test_scoped_staff_view_limits_users_to_department() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        departments = _department_ids(client, hotel_id, owner_headers)
        suffix = uuid4().hex[:8]
        staff_a = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Scoped Staff A",
            f"staff-a-{suffix}@example.com",
            department_id=departments["housekeeping"],
        )
        staff_b = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Scoped Staff B",
            f"staff-b-{suffix}@example.com",
            department_id=departments["engineering"],
        )
        role_id = _create_role(client, hotel_id, owner_headers, ["staff.view"], {"staff.view": "department"})
        _assign_roles(client, hotel_id, owner_headers, staff_a, [role_id])

        login = client.post("/api/v1/auth/login", json={"email": f"staff-a-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        users = client.get(f"/api/v1/hotels/{hotel_id}/users", headers=staff_headers)
        assert users.status_code == 200
        visible_ids = {item["id"] for item in users.json()["data"]}
        assert staff_a in visible_ids
        assert staff_b not in visible_ids

        other_profile = client.get(f"/api/v1/hotels/{hotel_id}/users/{staff_b}", headers=staff_headers)
        assert other_profile.status_code == 403


def test_role_permission_update_invalidates_cached_user_permissions() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        user_id = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Cached Staff",
            f"cached-{suffix}@example.com",
        )
        role_id = _create_role(client, hotel_id, owner_headers, ["ticket.view_own"])
        _assign_roles(client, hotel_id, owner_headers, user_id, [role_id])

        login = client.post("/api/v1/auth/login", json={"email": f"cached-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        me = client.get("/api/v1/auth/me", headers=staff_headers)
        assert me.status_code == 200
        assert "ticket.view_own" in me.json()["data"]["permissions"]

        updated_role = client.put(
            f"/api/v1/hotels/{hotel_id}/roles/{role_id}/permissions",
            headers=owner_headers,
            json={"permission_keys": []},
        )
        assert updated_role.status_code == 200

        refreshed_me = client.get("/api/v1/auth/me", headers=staff_headers)
        assert refreshed_me.status_code == 200
        assert "ticket.view_own" not in refreshed_me.json()["data"]["permissions"]


def test_staff_level_admin_without_rbac_permission_cannot_use_admin_dependency() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        adminish_id = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Admin By Title",
            f"admin-title-{suffix}@example.com",
            staff_level="admin",
        )

        login = client.post("/api/v1/auth/login", json={"email": f"admin-title-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        adminish_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        denied = client.get(f"/api/v1/hotels/{hotel_id}/audit-logs", headers=adminish_headers)
        assert denied.status_code == 403

        role_id = _create_role(client, hotel_id, owner_headers, ["hotel.settings.manage"])
        _assign_roles(client, hotel_id, owner_headers, adminish_id, [role_id])

        allowed = client.get(f"/api/v1/hotels/{hotel_id}/audit-logs", headers=adminish_headers)
        assert allowed.status_code == 200


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


def test_staff_duty_update_is_limited_to_self_or_admin() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        departments = _department_ids(client, hotel_id, owner_headers)
        suffix = uuid4().hex[:8]
        staff_a = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Duty Staff A",
            f"duty-a-{suffix}@example.com",
            department_id=departments["housekeeping"],
        )
        staff_b = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Duty Staff B",
            f"duty-b-{suffix}@example.com",
            department_id=departments["housekeeping"],
        )
        role_id = _create_role(
            client,
            hotel_id,
            owner_headers,
            ["staff.view", "staff.update"],
            {"staff.view": "department", "staff.update": "department"},
        )
        _assign_roles(client, hotel_id, owner_headers, staff_a, [role_id])

        login = client.post(
            "/api/v1/auth/login",
            json={"email": f"duty-a-{suffix}@example.com", "password": "secretpass123"},
        )
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        own_duty = client.patch(
            f"/api/v1/hotels/{hotel_id}/users/{staff_a}",
            headers=staff_headers,
            json={"is_on_duty": False},
        )
        assert own_duty.status_code == 200
        assert own_duty.json()["data"]["is_on_duty"] is False

        other_duty = client.patch(
            f"/api/v1/hotels/{hotel_id}/users/{staff_b}",
            headers=staff_headers,
            json={"is_on_duty": False},
        )
        assert other_duty.status_code == 403

        admin_duty = client.patch(
            f"/api/v1/hotels/{hotel_id}/users/{staff_b}",
            headers=owner_headers,
            json={"is_on_duty": False},
        )
        assert admin_duty.status_code == 200
        assert admin_duty.json()["data"]["is_on_duty"] is False


def test_mobile_api_denies_low_privilege_staff_management_and_inventory() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        staff_id = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Mobile Low Privilege",
            f"mobile-low-{suffix}@example.com",
        )
        target_id = _create_user(
            client,
            hotel_id,
            owner_headers,
            "Mobile Target",
            f"mobile-target-{suffix}@example.com",
        )
        login = client.post("/api/v1/auth/login", json={"email": f"mobile-low-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        users = client.get(f"/api/v1/mobile/hotels/{hotel_id}/users", headers=staff_headers)
        assert users.status_code == 403

        update_user = client.patch(
            f"/api/v1/mobile/hotels/{hotel_id}/users/{target_id}",
            headers=staff_headers,
            json={"Name": "Escalated Name"},
        )
        assert update_user.status_code == 403

        delete_user = client.delete(f"/api/v1/mobile/hotels/{hotel_id}/users/{target_id}", headers=staff_headers)
        assert delete_user.status_code == 403

        add_inventory = client.post(
            f"/api/v1/mobile/hotels/{hotel_id}/inventory",
            headers=staff_headers,
            json={"Name": "Unauthorized Item"},
        )
        assert add_inventory.status_code == 403

        me = client.get("/api/v1/mobile/auth/me", headers=staff_headers)
        assert me.status_code == 200
        assert me.json()["data"]["EmployeeId"] == staff_id


def test_mobile_task_list_respects_ticket_visibility_scope() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        suffix = uuid4().hex[:8]
        staff_a = _create_user(client, hotel_id, owner_headers, "Mobile Task A", f"mobile-task-a-{suffix}@example.com")
        staff_b = _create_user(client, hotel_id, owner_headers, "Mobile Task B", f"mobile-task-b-{suffix}@example.com")
        role_id = _create_role(
            client,
            hotel_id,
            owner_headers,
            ["ticket.view"],
            {"ticket.view": "own"},
        )
        _assign_roles(client, hotel_id, owner_headers, staff_a, [role_id])

        first = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={"assigned_to": staff_a, "item_description": "Visible mobile task", "priority": 2},
        )
        assert first.status_code == 200
        second = client.post(
            f"/api/v1/hotels/{hotel_id}/tickets",
            headers=owner_headers,
            json={"assigned_to": staff_b, "item_description": "Hidden mobile task", "priority": 2},
        )
        assert second.status_code == 200

        login = client.post("/api/v1/auth/login", json={"email": f"mobile-task-a-{suffix}@example.com", "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        tasks = client.get(f"/api/v1/mobile/hotels/{hotel_id}/tasks", headers=staff_headers)
        assert tasks.status_code == 200
        visible_ids = {item["TaskId"] for item in tasks.json()["data"]}
        assert first.json()["data"]["id"] in visible_ids
        assert second.json()["data"]["id"] not in visible_ids


def test_system_roles_cannot_be_updated_or_replaced() -> None:
    with TestClient(app) as client:
        hotel_id, _, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}

        roles = client.get(f"/api/v1/hotels/{hotel_id}/roles", headers=owner_headers)
        assert roles.status_code == 200
        system_role = next(role for role in roles.json()["data"] if role["is_system_role"])

        renamed = client.put(
            f"/api/v1/hotels/{hotel_id}/roles/{system_role['id']}",
            headers=owner_headers,
            json={"name": "Mutated System Role"},
        )
        assert renamed.status_code == 400

        replaced = client.put(
            f"/api/v1/hotels/{hotel_id}/roles/{system_role['id']}/permissions",
            headers=owner_headers,
            json={"permission_keys": []},
        )
        assert replaced.status_code == 400

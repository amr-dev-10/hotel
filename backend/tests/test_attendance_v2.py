from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.models.base import utcnow


def _bootstrap(client: TestClient) -> tuple[str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"attendance-v2-{suffix}",
            "name": "Attendance V2 Hotel",
            "owner_name": "Attendance Owner",
            "owner_email": f"attendance-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "seed_rooms": ["2001"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["access_token"]


def _create_staff(client: TestClient, hotel_id: str, headers: dict[str, str], name: str) -> dict:
    suffix = uuid4().hex[:8]
    response = client.post(
        f"/api/v1/hotels/{hotel_id}/users",
        headers=headers,
        json={
            "name": name,
            "email": f"{name.lower().replace(' ', '-')}-{suffix}@example.com",
            "password": "secretpass123",
            "employee_code": f"ATD{suffix[:5].upper()}",
            "staff_level": "attendant",
            "job_role": "Attendant",
        },
    )
    assert response.status_code == 200
    return response.json()["data"]


def test_attendance_v2_checkin_checkout_dashboard_and_finalize() -> None:
    with TestClient(app) as client:
        hotel_id, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        today = utcnow().date()

        staff = _create_staff(client, hotel_id, owner_headers, "Attendance Staff")
        absent_staff = _create_staff(client, hotel_id, owner_headers, "Absent Staff")

        template_response = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/templates",
            headers=owner_headers,
            json={
                "name": "Full Day",
                "code": "FULL",
                "start_time": "00:00",
                "end_time": "23:59",
                "break_minutes": 30,
                "grace_minutes": 5,
                "late_after_minutes": 5,
                "is_night_shift": False,
                "is_active": True,
            },
        )
        assert template_response.status_code == 200
        template = template_response.json()["data"]

        for user in (staff, absent_staff):
            assigned = client.post(
                f"/api/v1/hotels/{hotel_id}/attendance/assignments",
                headers=owner_headers,
                json={
                    "employee_id": user["id"],
                    "shift_template_id": template["id"],
                    "effective_from": today.isoformat(),
                    "working_days": [today.weekday()],
                    "rotation_type": "fixed",
                    "is_active": True,
                },
            )
            assert assigned.status_code == 200
            assert assigned.json()["data"]["template_code"] == "FULL"

        login = client.post(
            "/api/v1/auth/login",
            json={"email": staff["email"], "password": "secretpass123"},
        )
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        today_response = client.get(f"/api/v1/hotels/{hotel_id}/attendance/today", headers=staff_headers)
        assert today_response.status_code == 200
        today_payload = today_response.json()["data"]
        assert today_payload["can_check_in"] is True
        assert today_payload["template"]["code"] == "FULL"

        checked_in = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-in",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert checked_in.status_code == 200
        assert checked_in.json()["data"]["attendance_status"] == "CHECKED_IN"
        assert checked_in.json()["data"]["employee_code"] == staff["employee_code"]

        duplicate = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-in",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert duplicate.status_code == 400

        after_checkin = client.get(f"/api/v1/hotels/{hotel_id}/attendance/today", headers=staff_headers)
        assert after_checkin.status_code == 200
        assert after_checkin.json()["data"]["can_check_out"] is True

        dashboard = client.get(
            f"/api/v1/hotels/{hotel_id}/attendance/dashboard",
            headers=owner_headers,
            params={"attendance_date": today.isoformat()},
        )
        assert dashboard.status_code == 200
        assert dashboard.json()["data"]["checked_in"] == 1

        checked_out = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-out",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert checked_out.status_code == 200
        assert checked_out.json()["data"]["attendance_status"] == "COMPLETED"

        profile = client.get("/api/v1/auth/me", headers=staff_headers)
        assert profile.status_code == 200
        assert profile.json()["data"]["is_on_duty"] is False

        finalized = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/finalize-missing",
            headers=owner_headers,
            json={"attendance_date": today.isoformat()},
        )
        assert finalized.status_code == 200
        assert finalized.json()["data"]["created"] == 1

        finalized_again = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/finalize-missing",
            headers=owner_headers,
            json={"attendance_date": today.isoformat()},
        )
        assert finalized_again.status_code == 200
        assert finalized_again.json()["data"]["created"] == 0

        final_dashboard = client.get(
            f"/api/v1/hotels/{hotel_id}/attendance/dashboard",
            headers=owner_headers,
            params={"attendance_date": today.isoformat()},
        )
        assert final_dashboard.status_code == 200
        data = final_dashboard.json()["data"]
        assert data["checked_out"] == 1
        assert data["absent"] == 1


def test_bulk_default_shift_assignment_creates_template_and_skips_existing() -> None:
    with TestClient(app) as client:
        hotel_id, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        today = utcnow().date()

        _create_staff(client, hotel_id, owner_headers, "Default Staff One")
        _create_staff(client, hotel_id, owner_headers, "Default Staff Two")

        assigned = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/assignments/bulk-default",
            headers=owner_headers,
            json={
                "effective_from": today.isoformat(),
                "working_days": [today.weekday()],
                "rotation_type": "fixed",
                "overwrite_existing": False,
                "include_admins": False,
            },
        )
        assert assigned.status_code == 200
        data = assigned.json()["data"]
        assert data["shift_template_code"] == "MORNING"
        assert data["created"] == 2
        assert data["skipped"] == 0
        assert data["employee_count"] == 2

        templates = client.get(f"/api/v1/hotels/{hotel_id}/attendance/templates", headers=owner_headers)
        assert templates.status_code == 200
        default_templates = [item for item in templates.json()["data"] if item["is_default"]]
        assert len(default_templates) == 1
        assert default_templates[0]["code"] == "MORNING"

        assigned_again = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/assignments/bulk-default",
            headers=owner_headers,
            json={
                "effective_from": today.isoformat(),
                "working_days": [today.weekday()],
                "rotation_type": "fixed",
                "overwrite_existing": False,
                "include_admins": False,
            },
        )
        assert assigned_again.status_code == 200
        data_again = assigned_again.json()["data"]
        assert data_again["created"] == 0
        assert data_again["skipped"] == 2

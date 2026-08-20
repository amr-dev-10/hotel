from datetime import UTC, datetime, timedelta
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
            headers={**staff_headers, "X-Forwarded-For": "203.0.113.10, 10.0.0.20"},
            json={"method": "web", "gps_location": "12.971599,77.594566;accuracy=9m"},
        )
        assert checked_in.status_code == 200
        assert checked_in.json()["data"]["attendance_status"] == "CHECKED_IN"
        assert checked_in.json()["data"]["employee_code"] == staff["employee_code"]
        assert checked_in.json()["data"]["ip_address"] == "203.0.113.10"
        assert checked_in.json()["data"]["gps_location"] == "12.971599,77.594566;accuracy=9m"

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
            headers={**staff_headers, "X-Real-IP": "203.0.113.11"},
            json={"method": "web", "gps_location": "12.971700,77.594600;accuracy=12m"},
        )
        assert checked_out.status_code == 200
        assert checked_out.json()["data"]["attendance_status"] == "COMPLETED"
        assert checked_out.json()["data"]["ip_address"] == "203.0.113.11"
        assert checked_out.json()["data"]["gps_location"] == "12.971700,77.594600;accuracy=12m"

        after_checkout = client.get(f"/api/v1/hotels/{hotel_id}/attendance/today", headers=staff_headers)
        assert after_checkout.status_code == 200
        after_checkout_payload = after_checkout.json()["data"]
        assert after_checkout_payload["can_check_in"] is True
        assert after_checkout_payload["can_check_out"] is False

        checked_in_again = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-in",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert checked_in_again.status_code == 200
        checked_in_again_payload = checked_in_again.json()["data"]
        assert checked_in_again_payload["attendance_status"] == "CHECKED_IN"
        assert checked_in_again_payload["actual_end"] is None

        after_recheckin = client.get(f"/api/v1/hotels/{hotel_id}/attendance/today", headers=staff_headers)
        assert after_recheckin.status_code == 200
        assert after_recheckin.json()["data"]["can_check_out"] is True

        checked_out_again = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-out",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert checked_out_again.status_code == 200
        assert checked_out_again.json()["data"]["attendance_status"] == "COMPLETED"

        duplicate_checkout = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-out",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert duplicate_checkout.status_code == 400

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


def test_attendance_worked_minutes_accumulate_across_multiple_shift_punches(monkeypatch) -> None:
    import app.api.v1.attendance as attendance_api_module
    import app.services.attendance_service as attendance_service_module

    clock = {"now": datetime(2026, 1, 5, 9, 0, tzinfo=UTC)}
    monkeypatch.setattr(attendance_service_module, "utcnow", lambda: clock["now"])
    monkeypatch.setattr(attendance_api_module, "utcnow", lambda: clock["now"])

    with TestClient(app) as client:
        hotel_id, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        today = clock["now"].date()

        staff = _create_staff(client, hotel_id, owner_headers, "Multi Punch Staff")

        template_response = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/templates",
            headers=owner_headers,
            json={
                "name": "Split Shift",
                "code": "SPLIT",
                "start_time": "08:00",
                "end_time": "18:00",
                "break_minutes": 0,
                "grace_minutes": 0,
                "late_after_minutes": 0,
                "is_night_shift": False,
                "is_active": True,
            },
        )
        assert template_response.status_code == 200
        template = template_response.json()["data"]

        assigned = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/assignments",
            headers=owner_headers,
            json={
                "employee_id": staff["id"],
                "shift_template_id": template["id"],
                "effective_from": today.isoformat(),
                "working_days": [today.weekday()],
                "rotation_type": "fixed",
                "is_active": True,
            },
        )
        assert assigned.status_code == 200

        login = client.post(
            "/api/v1/auth/login",
            json={"email": staff["email"], "password": "secretpass123"},
        )
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        first_check_in = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-in",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert first_check_in.status_code == 200
        assert first_check_in.json()["data"]["worked_minutes"] == 0

        clock["now"] += timedelta(minutes=45)
        first_check_out = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-out",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert first_check_out.status_code == 200
        assert first_check_out.json()["data"]["attendance_status"] == "COMPLETED"
        assert first_check_out.json()["data"]["worked_minutes"] == 45

        clock["now"] += timedelta(minutes=15)
        second_check_in = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-in",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert second_check_in.status_code == 200
        second_check_in_payload = second_check_in.json()["data"]
        assert second_check_in_payload["attendance_status"] == "CHECKED_IN"
        assert second_check_in_payload["actual_end"] is None
        assert second_check_in_payload["worked_minutes"] == 45

        clock["now"] += timedelta(minutes=20)
        live_today = client.get(f"/api/v1/hotels/{hotel_id}/attendance/today", headers=staff_headers)
        assert live_today.status_code == 200
        assert live_today.json()["data"]["log"]["worked_minutes"] == 65

        live_dashboard = client.get(
            f"/api/v1/hotels/{hotel_id}/attendance/dashboard",
            headers=owner_headers,
            params={"attendance_date": today.isoformat()},
        )
        assert live_dashboard.status_code == 200
        assert live_dashboard.json()["data"]["logs"][0]["worked_minutes"] == 65

        clock["now"] += timedelta(minutes=25)
        second_check_out = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-out",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert second_check_out.status_code == 200
        assert second_check_out.json()["data"]["attendance_status"] == "COMPLETED"
        assert second_check_out.json()["data"]["worked_minutes"] == 90


def test_attendance_check_in_requires_active_shift_window(monkeypatch) -> None:
    import app.services.attendance_service as attendance_service_module

    fixed_now = datetime(2026, 1, 5, 10, 0, tzinfo=UTC)
    monkeypatch.setattr(attendance_service_module, "utcnow", lambda: fixed_now)

    with TestClient(app) as client:
        hotel_id, owner_token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {owner_token}"}
        today = fixed_now.date()

        staff = _create_staff(client, hotel_id, owner_headers, "Window Staff")

        template_response = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/templates",
            headers=owner_headers,
            json={
                "name": "Early Shift",
                "code": "EARLY",
                "start_time": "08:00",
                "end_time": "09:00",
                "break_minutes": 0,
                "grace_minutes": 0,
                "late_after_minutes": 0,
                "is_night_shift": False,
                "is_active": True,
            },
        )
        assert template_response.status_code == 200
        template = template_response.json()["data"]

        assigned = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/assignments",
            headers=owner_headers,
            json={
                "employee_id": staff["id"],
                "shift_template_id": template["id"],
                "effective_from": today.isoformat(),
                "working_days": [today.weekday()],
                "rotation_type": "fixed",
                "is_active": True,
            },
        )
        assert assigned.status_code == 200

        login = client.post(
            "/api/v1/auth/login",
            json={"email": staff["email"], "password": "secretpass123"},
        )
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        today_response = client.get(f"/api/v1/hotels/{hotel_id}/attendance/today", headers=staff_headers)
        assert today_response.status_code == 200
        assert today_response.json()["data"]["can_check_in"] is False

        blocked = client.post(
            f"/api/v1/hotels/{hotel_id}/attendance/check-in",
            headers=staff_headers,
            json={"method": "web"},
        )
        assert blocked.status_code == 400
        assert blocked.json()["detail"]["message"] == "Check-in is only allowed during the assigned shift window"


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

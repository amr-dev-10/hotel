import re
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.platform_admin import PlatformAdmin


def _bootstrap(client: TestClient) -> tuple[str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"employee-code-{suffix}",
            "name": "Taj Palace",
            "owner_name": "Employee Owner",
            "owner_email": f"employee-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "seed_rooms": ["1001"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["access_token"]


def _seed_platform_admin() -> tuple[str, str]:
    email = f"employee-code-platform-{uuid4().hex[:8]}@example.com"
    password = "PlatformPass123!"
    db = SessionLocal()
    try:
        db.add(
            PlatformAdmin(
                name="Employee Code Platform Admin",
                email=email,
                password_hash=hash_password(password),
                is_active=True,
            )
        )
        db.commit()
    finally:
        db.close()
    return email, password


def test_employee_code_generation_create_uniqueness_and_search() -> None:
    with TestClient(app) as client:
        hotel_id, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}
        suffix = uuid4().hex[:8]

        generated = client.post(
            f"/api/v1/hotels/{hotel_id}/users/employee-code/generate",
            headers=headers,
            json={"staff_level": "manager", "job_role": "Receptionist"},
        )
        assert generated.status_code == 200
        generated_code = generated.json()["data"]["employee_code"]
        assert re.fullmatch(r"TAJMANG\d{3}[A-Z]{2}", generated_code)

        created = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "Employee Code Staff",
                "email": f"code-staff-{suffix}@example.com",
                "password": "secretpass123",
                "employee_code": "tajmang234ax",
                "staff_level": "manager",
                "job_role": "Manager",
            },
        )
        assert created.status_code == 200
        user = created.json()["data"]
        assert user["employee_code"] == "TAJMANG234AX"

        duplicate = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "Duplicate Employee Code",
                "email": f"code-duplicate-{suffix}@example.com",
                "password": "secretpass123",
                "employee_code": "TAJMANG234AX",
                "staff_level": "attendant",
                "job_role": "Attendant",
            },
        )
        assert duplicate.status_code == 400

        listed = client.get(f"/api/v1/hotels/{hotel_id}/users", headers=headers, params={"q": "tajmang234ax"})
        assert listed.status_code == 200
        assert user["id"] in {item["id"] for item in listed.json()["data"]}


def test_platform_admin_can_generate_employee_code_for_hotel() -> None:
    with TestClient(app) as client:
        hotel_id, _ = _bootstrap(client)
        platform_email, platform_password = _seed_platform_admin()

        login = client.post(
            "/api/v1/platform/auth/login",
            json={"email": platform_email, "password": platform_password},
        )
        assert login.status_code == 200
        platform_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        generated = client.post(
            f"/api/v1/platform/hotels/{hotel_id}/users/employee-code/generate",
            headers=platform_headers,
            json={"staff_level": "manager", "job_role": "Receptionist"},
        )
        assert generated.status_code == 200
        assert re.fullmatch(r"TAJMANG\d{3}[A-Z]{2}", generated.json()["data"]["employee_code"])


def test_employee_self_profile_email_and_photo_update() -> None:
    with TestClient(app) as client:
        hotel_id, token = _bootstrap(client)
        owner_headers = {"Authorization": f"Bearer {token}"}
        suffix = uuid4().hex[:8]
        original_email = f"profile-staff-{suffix}@example.com"

        created = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=owner_headers,
            json={
                "name": "Profile Staff",
                "email": original_email,
                "password": "secretpass123",
                "employee_code": "TAJATTD111AA",
                "staff_level": "attendant",
                "job_role": "Attendant",
            },
        )
        assert created.status_code == 200

        login = client.post("/api/v1/auth/login", json={"email": original_email, "password": "secretpass123"})
        assert login.status_code == 200
        staff_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

        code_login = client.post("/api/v1/auth/login", json={"email": "tajattd111aa", "password": "secretpass123"})
        assert code_login.status_code == 200
        code_headers = {"Authorization": f"Bearer {code_login.json()['data']['access_token']}"}
        code_profile = client.get("/api/v1/auth/me", headers=code_headers)
        assert code_profile.status_code == 200
        assert code_profile.json()["data"]["email"] == original_email
        assert code_profile.json()["data"]["employee_code"] == "TAJATTD111AA"

        current_profile = client.get("/api/v1/auth/me", headers=staff_headers)
        assert current_profile.status_code == 200
        assert current_profile.json()["data"]["employee_code"] == "TAJATTD111AA"

        next_email = f"profile-updated-{suffix}@example.com"
        updated_email = client.patch("/api/v1/auth/me", headers=staff_headers, json={"email": next_email})
        assert updated_email.status_code == 200
        assert updated_email.json()["data"]["email"] == next_email
        assert updated_email.json()["data"]["employee_code"] == "TAJATTD111AA"

        updated_photo = client.post(
            "/api/v1/auth/me/profile-image",
            headers=staff_headers,
            json={
                "file_type": "image/png",
                "file_name": "profile.png",
                "file_size_bytes": 8,
                "storage_provider": "database",
                "file_data_base64": "iVBORw0KGgo=",
            },
        )
        assert updated_photo.status_code == 200
        data = updated_photo.json()["data"]
        assert data["profile_image_url"].startswith(f"/media/mobile/{hotel_id}/")
        assert data["employee_code"] == "TAJATTD111AA"

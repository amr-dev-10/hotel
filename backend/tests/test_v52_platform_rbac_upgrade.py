from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.main import app
from app.models.ops import AuditLog
from app.models.platform_admin import PlatformAdmin
from app.models.user import User, UserSession


def _bootstrap(client: TestClient) -> tuple[str, str, str]:
    suffix = uuid4().hex[:8]
    response = client.post(
        "/api/v1/hotels/bootstrap",
        json={
            "slug": f"v52-hotel-{suffix}",
            "name": "Arcadia V52 Hotel",
            "owner_name": "V52 Owner",
            "owner_email": f"v52-owner-{suffix}@example.com",
            "owner_password": "secretpass123",
            "seed_rooms": ["5201", "5202"],
        },
    )
    assert response.status_code == 200
    data = response.json()["data"]
    return data["hotel"]["id"], data["owner"]["id"], data["access_token"]


def _seed_platform_admin() -> tuple[str, str]:
    email = f"platform-{uuid4().hex[:8]}@example.com"
    password = "PlatformPass123!"
    db = SessionLocal()
    try:
        admin = PlatformAdmin(
            name="Platform Admin",
            email=email,
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
    return email, password


def test_role_reads_include_permissions_and_atomic_permission_update() -> None:
    with TestClient(app) as client:
        hotel_id, _, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}

        created = client.post(
            f"/api/v1/hotels/{hotel_id}/roles",
            headers=headers,
            json={
                "name": f"Reservations {uuid4().hex[:6]}",
                "permission_codes": ["reservation.view", "reservation.create"],
            },
        )
        assert created.status_code == 200
        role = created.json()["data"]
        assert {item["code"] for item in role["permissions"]} == {
            "reservation.view",
            "reservation.create",
        }

        permissions = client.get(f"/api/v1/hotels/{hotel_id}/roles/permissions/all", headers=headers)
        assert permissions.status_code == 200
        assert "reservation.cancel" in {item["code"] for item in permissions.json()["data"]}

        updated = client.put(
            f"/api/v1/hotels/{hotel_id}/roles/{role['id']}/permissions",
            headers=headers,
            json={"permission_keys": ["reservation.view", "reservation.cancel"]},
        )
        assert updated.status_code == 200
        assert {item["code"] for item in updated.json()["data"]["permissions"]} == {
            "reservation.view",
            "reservation.cancel",
        }


def test_user_update_delete_soft_delete_sessions_and_audit() -> None:
    with TestClient(app) as client:
        hotel_id, _, token = _bootstrap(client)
        headers = {"Authorization": f"Bearer {token}"}
        suffix = uuid4().hex[:8]
        email = f"staff-{suffix}@example.com"

        created = client.post(
            f"/api/v1/hotels/{hotel_id}/users",
            headers=headers,
            json={
                "name": "V52 Staff",
                "email": email,
                "password": "secretpass123",
                "staff_level": "attendant",
                "job_role": "Attendant",
            },
        )
        assert created.status_code == 200
        user_id = created.json()["data"]["id"]
        assert created.json()["data"]["user_type"] == "HOTEL_EMPLOYEE"

        login = client.post("/api/v1/auth/login", json={"email": email, "password": "secretpass123"})
        assert login.status_code == 200

        patched = client.patch(
            f"/api/v1/hotels/{hotel_id}/users/{user_id}",
            headers=headers,
            json={"name": "V52 Supervisor", "staff_level": "supervisor", "is_on_duty": True},
        )
        assert patched.status_code == 200
        assert patched.json()["data"]["name"] == "V52 Supervisor"
        assert patched.json()["data"]["staff_level"] == "supervisor"

        deleted = client.delete(f"/api/v1/hotels/{hotel_id}/users/{user_id}", headers=headers)
        assert deleted.status_code == 200
        assert deleted.json()["data"]["deleted"] is True

        users = client.get(f"/api/v1/hotels/{hotel_id}/users", headers=headers)
        assert users.status_code == 200
        assert user_id not in {item["id"] for item in users.json()["data"]}

        db = SessionLocal()
        try:
            user = db.get(User, user_id)
            assert user is not None
            assert user.is_deleted is True
            assert user.deleted_at is not None
            assert user.is_active is False
            active_session = (
                db.query(UserSession)
                .filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None))
                .first()
            )
            assert active_session is None
            audit_actions = {
                row.action
                for row in db.query(AuditLog).filter(AuditLog.entity == "user", AuditLog.entity_id == user_id).all()
            }
            assert {"user.created", "user.updated", "user.deleted"} <= audit_actions
        finally:
            db.close()


def test_platform_admin_scope_and_dashboard_endpoints() -> None:
    with TestClient(app) as client:
        hotel_id, _, hotel_token = _bootstrap(client)
        platform_email, platform_password = _seed_platform_admin()

        hotel_on_platform = client.get(
            "/api/v1/platform/hotels",
            headers={"Authorization": f"Bearer {hotel_token}"},
        )
        assert hotel_on_platform.status_code == 403

        login = client.post(
            "/api/v1/platform/auth/login",
            json={"email": platform_email, "password": platform_password},
        )
        assert login.status_code == 200
        platform_token = login.json()["data"]["access_token"]
        platform_headers = {"Authorization": f"Bearer {platform_token}"}

        platform_on_hotel = client.get(f"/api/v1/hotels/{hotel_id}", headers=platform_headers)
        assert platform_on_hotel.status_code == 403

        dashboard = client.get("/api/v1/platform/dashboard", headers=platform_headers)
        assert dashboard.status_code == 200
        data = dashboard.json()["data"]
        assert data["total_hotels"] >= 1
        assert data["total_rooms"] >= 2
        assert "mrr" in data

        settings = client.get("/api/v1/platform/platform-settings", headers=platform_headers)
        assert settings.status_code == 200
        assert {"ai_providers", "feature_flags"} <= {item["key"] for item in settings.json()["data"]}

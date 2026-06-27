from uuid import uuid4

import pytest

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password, verify_password
from app.models.platform_admin import PlatformAdmin
from app.seeds.reset_platform_admin_password import reset_platform_admin_password


def _create_platform_admin(email: str, password: str, *, is_active: bool = True) -> None:
    init_db()
    db = SessionLocal()
    try:
        db.add(
            PlatformAdmin(
                name="Recovery Test Admin",
                email=email,
                password_hash=hash_password(password),
                is_active=is_active,
            )
        )
        db.commit()
    finally:
        db.close()


def test_reset_platform_admin_password_updates_existing_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    email = f"platform-recovery-{uuid4().hex[:8]}@example.com"
    old_password = "OldPlatformPass123!"
    new_password = "NewPlatformPass123!"
    _create_platform_admin(email, old_password)

    monkeypatch.setenv("PLATFORM_ADMIN_EMAIL", email)
    monkeypatch.setenv("PLATFORM_ADMIN_NEW_PASSWORD", new_password)

    reset_platform_admin_password()

    db = SessionLocal()
    try:
        admin = db.query(PlatformAdmin).filter(PlatformAdmin.email == email).one()
        assert verify_password(new_password, admin.password_hash)
        assert not verify_password(old_password, admin.password_hash)
    finally:
        db.close()


def test_reset_platform_admin_password_requires_existing_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLATFORM_ADMIN_EMAIL", f"missing-{uuid4().hex[:8]}@example.com")
    monkeypatch.setenv("PLATFORM_ADMIN_NEW_PASSWORD", "NewPlatformPass123!")

    with pytest.raises(RuntimeError, match="Platform admin not found"):
        reset_platform_admin_password()


def test_reset_platform_admin_password_rejects_inactive_admin(monkeypatch: pytest.MonkeyPatch) -> None:
    email = f"inactive-platform-{uuid4().hex[:8]}@example.com"
    _create_platform_admin(email, "OldPlatformPass123!", is_active=False)

    monkeypatch.setenv("PLATFORM_ADMIN_EMAIL", email)
    monkeypatch.setenv("PLATFORM_ADMIN_NEW_PASSWORD", "NewPlatformPass123!")

    with pytest.raises(RuntimeError, match="Platform admin is inactive"):
        reset_platform_admin_password()

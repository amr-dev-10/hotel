import os

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password, verify_password
from app.models.platform_admin import PlatformAdmin


def reset_platform_admin_password() -> None:
    email = os.getenv("PLATFORM_ADMIN_EMAIL", "admin@arcadia.io")
    new_password = os.getenv("PLATFORM_ADMIN_NEW_PASSWORD")
    if not new_password:
        raise RuntimeError("PLATFORM_ADMIN_NEW_PASSWORD is required")

    db = SessionLocal()
    try:
        admin = db.execute(select(PlatformAdmin).where(PlatformAdmin.email == email)).scalar_one_or_none()
        if not admin:
            raise RuntimeError(f"Platform admin not found: {email}")
        if not admin.is_active:
            raise RuntimeError(f"Platform admin is inactive: {email}")
        if verify_password(new_password, admin.password_hash):
            raise RuntimeError("New password must be different from current password")

        admin.password_hash = hash_password(new_password)
        db.commit()
        print(f"Platform admin password reset: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    reset_platform_admin_password()

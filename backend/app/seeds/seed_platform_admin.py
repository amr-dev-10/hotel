import os

from sqlalchemy import select

from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.models.platform_admin import PlatformAdmin


def seed_platform_admin() -> None:
    init_db()
    name = os.getenv("PLATFORM_ADMIN_NAME", "Arcadia Admin")
    email = os.getenv("PLATFORM_ADMIN_EMAIL", "admin@arcadia.io")
    password = os.getenv("PLATFORM_ADMIN_PASSWORD")
    if not password:
        raise RuntimeError("PLATFORM_ADMIN_PASSWORD is required")

    db = SessionLocal()
    try:
        existing = db.execute(select(PlatformAdmin).where(PlatformAdmin.email == email)).scalar_one_or_none()
        if existing:
            print(f"Platform admin already exists: {email}")
            return
        admin = PlatformAdmin(
            name=name,
            email=email,
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"Platform admin created: {email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed_platform_admin()

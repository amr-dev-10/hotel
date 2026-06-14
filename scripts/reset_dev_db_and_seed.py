from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from sqlalchemy import text


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

import app.models  # noqa: E402,F401
from app.core.config import settings  # noqa: E402
from app.core.database import Base, SessionLocal, engine, init_db  # noqa: E402
from app.schemas.auth import CurrentUserRead  # noqa: E402
from app.schemas.hotel import HotelRead  # noqa: E402
from app.services.demo_data_service import DemoDataService  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset the local development database and seed demo data.")
    parser.add_argument("--yes", action="store_true", help="Confirm destructive local development reset.")
    args = parser.parse_args()

    if not args.yes:
        raise SystemExit("Refusing to reset database without --yes")
    if settings.environment.lower() == "production":
        raise SystemExit("Refusing to reset database when ENVIRONMENT=production")

    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            connection.execute(text("drop schema if exists public cascade"))
            connection.execute(text("create schema public"))
            connection.execute(text("grant all on schema public to public"))
    else:
        Base.metadata.drop_all(bind=engine)
    init_db()

    db = SessionLocal()
    try:
        result = DemoDataService(db).seed()
        payload = {
            "hotel": HotelRead.model_validate(result["hotel"]).model_dump(),
            "owner": CurrentUserRead.model_validate(result["owner"]).model_dump(),
            "credentials": result["credentials"],
            "access_token": result["access_token"],
            "token_type": result["token_type"],
            "database_url": _mask_url(settings.database_url),
        }
        print(json.dumps(payload, indent=2, default=str))
    finally:
        db.close()


def _mask_url(url: str) -> str:
    if "@" not in url or "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    return f"{scheme}://***@{rest.split('@', 1)[1]}"


if __name__ == "__main__":
    main()

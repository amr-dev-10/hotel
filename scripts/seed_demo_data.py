from __future__ import annotations

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))

from app.core.database import SessionLocal, init_db  # noqa: E402
from app.schemas.auth import CurrentUserRead  # noqa: E402
from app.schemas.hotel import HotelRead  # noqa: E402
from app.services.demo_data_service import DemoDataService  # noqa: E402


def main() -> None:
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
        }
        print(json.dumps(payload, indent=2, default=str))
    finally:
        db.close()


if __name__ == "__main__":
    main()

from pathlib import Path
import os
import sys
import tempfile
from collections.abc import Callable

backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

test_db = Path(tempfile.gettempdir()) / "arcadia_backend_test.db"
if test_db.exists():
    test_db.unlink()

os.environ["DATABASE_URL"] = f"sqlite:///{test_db}"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["RATE_LIMIT_ENABLED"] = "false"
os.environ["WHATSAPP_DRY_RUN"] = "true"

import pytest  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture
def auth_headers_for_user() -> Callable[[User], dict[str, str]]:
    def _headers(user: User) -> dict[str, str]:
        token = create_access_token(user.id, user.hotel_id)
        return {"Authorization": f"Bearer {token}"}

    return _headers

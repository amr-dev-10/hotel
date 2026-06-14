import json
import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.vault import Vault
from app.integrations.ai.factory import get_ai_provider


AI_SETTINGS_SECRET = "ai_settings"


class AISettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.vault = Vault(db)

    def get(self, hotel_id: str) -> dict:
        stored = self._load(hotel_id)
        return {
            "provider": stored.get("provider", settings.default_ai_provider),
            "model": stored.get("model"),
            "status": stored.get("status", "default"),
            "last_tested_at": stored.get("last_tested_at"),
            "embedding_provider": stored.get("embedding_provider"),
            "embedding_model": stored.get("embedding_model"),
        }

    def update(self, hotel_id: str, payload) -> dict:
        started = time.perf_counter()
        provider = get_ai_provider(payload.provider)
        preview = provider.generate("Hello! I am working correctly.", max_tokens=80)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        data = {
            "provider": payload.provider,
            "model": payload.model,
            "status": "connected",
            "last_tested_at": self._now_iso(),
            "embedding_provider": payload.embedding_provider,
            "embedding_model": payload.embedding_model,
            "response_time_ms": elapsed_ms,
            "response_preview": preview[:120],
        }
        self.vault.store(hotel_id, AI_SETTINGS_SECRET, json.dumps(data), commit=False)
        if payload.api_key:
            self.vault.store(hotel_id, f"ai:{payload.provider}:api_key", payload.api_key, commit=False)
        self.db.commit()
        return self.get(hotel_id)

    def test(self, hotel_id: str) -> dict:
        data = self._load(hotel_id)
        provider_name = data.get("provider", settings.default_ai_provider)
        started = time.perf_counter()
        response = get_ai_provider(provider_name).generate("Hello! I am working correctly.", max_tokens=80)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        data["status"] = "connected"
        data["last_tested_at"] = self._now_iso()
        data["response_time_ms"] = elapsed_ms
        data["response_preview"] = response[:120]
        self.vault.store(hotel_id, AI_SETTINGS_SECRET, json.dumps(data), commit=True)
        return {
            "success": True,
            "provider": provider_name,
            "response_time_ms": elapsed_ms,
            "response_preview": response[:120],
        }

    def delete(self, hotel_id: str) -> dict:
        data = {
            "provider": settings.default_ai_provider,
            "model": None,
            "status": "default",
            "last_tested_at": None,
            "embedding_provider": None,
            "embedding_model": None,
        }
        self.vault.store(hotel_id, AI_SETTINGS_SECRET, json.dumps(data), commit=True)
        return data

    def _load(self, hotel_id: str) -> dict:
        raw = self.vault.retrieve(hotel_id, AI_SETTINGS_SECRET)
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def _now_iso(self) -> str:
        from app.models.base import utcnow

        return utcnow().isoformat()

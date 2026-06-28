import json
import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.vault import Vault
from app.integrations.ai.factory import PROVIDERS, get_ai_provider


AI_SETTINGS_SECRET = "ai_settings"

DEFAULT_AI_SETTINGS = {
    "provider": settings.default_ai_provider,
    "model": None,
    "status": "default",
    "last_tested_at": None,
    "embedding_provider": None,
    "embedding_model": None,
    "is_active": False,
    "temperature": 0.3,
    "high_confidence_threshold": 0.95,
    "low_confidence_threshold": 0.8,
    "max_context_messages": 20,
    "language": "en",
    "enable_ticket_creation": True,
    "enable_auto_reply": False,
    "enable_sentiment_analysis": True,
    "escalation_department_key": "front_office",
    "system_prompt": None,
}


class AISettingsService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.vault = Vault(db)

    def get(self, hotel_id: str) -> dict:
        stored = self._load(hotel_id)
        return {**DEFAULT_AI_SETTINGS, **stored}

    def update(self, hotel_id: str, payload) -> dict:
        started = time.perf_counter()
        existing = self.get(hotel_id)
        api_key = payload.api_key or self.vault.retrieve(hotel_id, f"ai:{payload.provider}:api_key")
        provider = get_ai_provider(payload.provider, api_key=api_key, model=payload.model)
        preview = provider.generate("Hello! I am working correctly.", max_tokens=80)
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        data = {
            **existing,
            "provider": payload.provider,
            "model": payload.model,
            "status": "connected",
            "last_tested_at": self._now_iso(),
            "embedding_provider": payload.embedding_provider,
            "embedding_model": payload.embedding_model,
            "is_active": payload.is_active if payload.is_active is not None else True,
            "temperature": payload.temperature,
            "high_confidence_threshold": payload.high_confidence_threshold,
            "low_confidence_threshold": payload.low_confidence_threshold,
            "max_context_messages": payload.max_context_messages,
            "language": payload.language,
            "enable_ticket_creation": payload.enable_ticket_creation,
            "enable_auto_reply": payload.enable_auto_reply,
            "enable_sentiment_analysis": payload.enable_sentiment_analysis,
            "escalation_department_key": payload.escalation_department_key,
            "system_prompt": payload.system_prompt,
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
        model = data.get("model")
        api_key = self.vault.retrieve(hotel_id, f"ai:{provider_name}:api_key")
        started = time.perf_counter()
        response = get_ai_provider(provider_name, api_key=api_key, model=model).generate(
            "Hello! I am working correctly.",
            max_tokens=80,
        )
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
        data = dict(DEFAULT_AI_SETTINGS)
        self.vault.store(hotel_id, AI_SETTINGS_SECRET, json.dumps(data), commit=False)
        for provider_name in PROVIDERS:
            self.vault.delete(hotel_id, f"ai:{provider_name}:api_key", commit=False)
        self.db.commit()
        return data

    def is_runtime_enabled(self, hotel_id: str) -> bool:
        data = self.get(hotel_id)
        return bool(
            data.get("is_active")
            and data.get("status") == "connected"
            and data.get("provider") != "local"
        )

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

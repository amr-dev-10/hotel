from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.bot_config import BotConfig
from app.models.knowledge import (
    BotVersion,
    DepartmentConfig,
    HotelFAQ,
    HotelLanguage,
    ServiceForm,
    ServiceFormField,
)
from app.repositories.bot_config_repository import BotConfigRepository
from app.repositories.knowledge_repository import (
    BotVersionRepository,
    DepartmentConfigRepository,
    FAQRepository,
    HotelLanguageRepository,
    ServiceFormRepository,
)
from app.schemas.knowledge import DepartmentConfigUpsert, FAQCreate, HotelLanguageUpsert, ServiceFormCreate
from app.services.audit_service import AuditService


class FAQService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.faqs = FAQRepository(db)

    def create(self, hotel_id: str, payload: FAQCreate, actor_id: str | None = None) -> HotelFAQ:
        faq = HotelFAQ(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(faq)
        self.db.flush()
        AuditService(self.db).log(hotel_id, "faq.created", "hotel_faq", faq.id, actor_id)
        self.db.commit()
        self.db.refresh(faq)
        return faq

    def answer(self, hotel_id: str, text: str) -> str | None:
        normalized = {word for word in text.lower().replace("?", " ").split() if len(word) > 2}
        if not normalized:
            return None
        best_score = 0
        best_answer = None
        for faq in self.faqs.list_active(hotel_id):
            haystack = f"{faq.question} {faq.category or ''}".lower()
            score = sum(1 for word in normalized if word in haystack)
            if score > best_score:
                best_score = score
                best_answer = faq.answer
        return best_answer if best_score else None


class BotVersionService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.versions = BotVersionRepository(db)
        self.configs = BotConfigRepository(db)

    def publish_current(self, hotel_id: str, actor_id: str | None) -> BotVersion:
        config = self.configs.get_for_hotel(hotel_id)
        config_json: dict[str, Any] = {}
        if config:
            config_json = {
                "main_menu": config.main_menu,
                "services": config.services,
                "messages": config.messages,
                "sla_config": config.sla_config,
                "active_hours": config.active_hours,
                "gemini_fallback_enabled": config.gemini_fallback_enabled,
            }
        version = BotVersion(
            hotel_id=hotel_id,
            version=self.versions.next_version(hotel_id),
            config_json=config_json,
            published_by=actor_id,
            created_at=datetime.now(UTC),
        )
        self.db.add(version)
        AuditService(self.db).log(hotel_id, "bot.version.published", "bot_version", version.id, actor_id)
        self.db.commit()
        self.db.refresh(version)
        return version

    def rollback(self, hotel_id: str, version_number: int, actor_id: str | None) -> BotConfig:
        target = None
        for version in self.versions.list_for_hotel(hotel_id, limit=500):
            if version.version == version_number:
                target = version
                break
        if not target:
            raise not_found("Bot version not found")

        config = self.configs.get_for_hotel(hotel_id)
        if not config:
            config = BotConfig(
                hotel_id=hotel_id,
                main_menu=[],
                services=[],
                messages={},
                sla_config={},
                active_hours={},
                gemini_fallback_enabled=True,
            )
            self.db.add(config)
            self.db.flush()

        for key, value in target.config_json.items():
            setattr(config, key, value)
        config.active_version = target.version
        AuditService(self.db).log(
            hotel_id,
            "bot.config.rollback",
            "bot_config",
            config.id,
            actor_id,
            {"version": target.version},
        )
        self.db.commit()
        self.db.refresh(config)
        return config


class HotelLanguageService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.languages = HotelLanguageRepository(db)

    def upsert(self, hotel_id: str, payload: HotelLanguageUpsert) -> HotelLanguage:
        language = self.languages.get(hotel_id)
        if not language:
            language = HotelLanguage(hotel_id=hotel_id, **payload.model_dump())
            self.db.add(language)
        else:
            language.default_language = payload.default_language
            language.supported_languages = payload.supported_languages
        self.db.commit()
        self.db.refresh(language)
        return language


class DepartmentConfigService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.configs = DepartmentConfigRepository(db)

    def upsert(self, hotel_id: str, payload: DepartmentConfigUpsert) -> DepartmentConfig:
        config = self.configs.get_for_department(hotel_id, payload.department_id)
        if not config:
            config = DepartmentConfig(hotel_id=hotel_id, **payload.model_dump())
            self.db.add(config)
        else:
            config.keywords = payload.keywords
            config.sla_minutes = payload.sla_minutes
            config.auto_assignment_enabled = payload.auto_assignment_enabled
            config.assignment_strategy = payload.assignment_strategy
        self.db.commit()
        self.db.refresh(config)
        return config


class ServiceFormService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, hotel_id: str, payload: ServiceFormCreate, actor_id: str | None) -> ServiceForm:
        form = ServiceForm(
            hotel_id=hotel_id,
            service_name=payload.service_name,
            service_id=payload.service_id,
            is_active=True,
        )
        self.db.add(form)
        self.db.flush()
        for index, field in enumerate(payload.fields):
            self.db.add(
                ServiceFormField(
                    hotel_id=hotel_id,
                    service_form_id=form.id,
                    field_name=field["field_name"],
                    field_type=field.get("field_type", "text"),
                    label=field.get("label") or field["field_name"],
                    required=bool(field.get("required", field.get("is_required", False))),
                    options=field.get("options", []),
                    sort_order=int(field.get("sort_order", index)),
                )
            )
        AuditService(self.db).log(hotel_id, "service_form.created", "service_form", form.id, actor_id)
        self.db.commit()
        self.db.refresh(form)
        return form

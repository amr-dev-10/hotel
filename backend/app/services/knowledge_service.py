from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.bot_config import BotConfig
from app.models.knowledge import (
    BotVersion,
    DepartmentConfig,
    HotelFAQ,
    HotelLanguage,
    KnowledgeDocument,
    KnowledgeDocumentVersion,
    KnowledgeEmbedding,
    ServiceForm,
    ServiceFormField,
)
from app.repositories.bot_config_repository import BotConfigRepository
from app.repositories.knowledge_repository import (
    BotVersionRepository,
    DepartmentConfigRepository,
    FAQRepository,
    HotelLanguageRepository,
    KnowledgeDocumentRepository,
    KnowledgeDocumentVersionRepository,
    KnowledgeEmbeddingRepository,
    ServiceFormRepository,
)
from app.schemas.knowledge import (
    DepartmentConfigUpsert,
    FAQCreate,
    HotelLanguageUpsert,
    KnowledgeDocumentCreate,
    KnowledgeDocumentUpdate,
    ServiceFormCreate,
)
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


class KnowledgeDocumentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.documents = KnowledgeDocumentRepository(db)
        self.versions = KnowledgeDocumentVersionRepository(db)
        self.embeddings = KnowledgeEmbeddingRepository(db)

    def create(
        self,
        hotel_id: str,
        payload: KnowledgeDocumentCreate,
        actor_id: str | None,
    ) -> KnowledgeDocument:
        data = payload.model_dump(exclude={"change_note"})
        document = KnowledgeDocument(hotel_id=hotel_id, **data)
        self.db.add(document)
        self.db.flush()
        self._snapshot_version(document, 1, actor_id, payload.change_note or "Initial version")
        self._queue_embeddings(document)
        self.process_document_embeddings(document)
        AuditService(self.db).log(hotel_id, "knowledge.created", "knowledge_document", document.id, actor_id)
        self.db.commit()
        self.db.refresh(document)
        return document

    def update(
        self,
        hotel_id: str,
        document_id: str,
        payload: KnowledgeDocumentUpdate,
        actor_id: str | None,
    ) -> KnowledgeDocument:
        document = self.documents.get_for_hotel(hotel_id, document_id)
        if not document:
            raise not_found("Knowledge document not found")
        data = payload.model_dump(exclude_unset=True, exclude={"change_note"})
        content_changed = "content" in data or "file_url" in data
        for key, value in data.items():
            setattr(document, key, value)
        if content_changed:
            version_number = self.versions.next_version(document.id)
            document.current_version = version_number
            self._snapshot_version(document, version_number, actor_id, payload.change_note)
            self._queue_embeddings(document)
            self.process_document_embeddings(document)
        AuditService(self.db).log(hotel_id, "knowledge.updated", "knowledge_document", document.id, actor_id)
        self.db.commit()
        self.db.refresh(document)
        return document

    def delete(self, hotel_id: str, document_id: str, actor_id: str | None) -> None:
        document = self.documents.get_for_hotel(hotel_id, document_id)
        if not document:
            raise not_found("Knowledge document not found")
        document.is_active = False
        AuditService(self.db).log(hotel_id, "knowledge.deleted", "knowledge_document", document.id, actor_id)
        self.db.commit()

    def versions_for_document(self, hotel_id: str, document_id: str) -> list[KnowledgeDocumentVersion]:
        document = self.documents.get_for_hotel(hotel_id, document_id)
        if not document:
            raise not_found("Knowledge document not found")
        return list(self.versions.list_for_document(hotel_id, document_id))

    def rollback(
        self,
        hotel_id: str,
        document_id: str,
        version_number: int,
        actor_id: str | None,
    ) -> KnowledgeDocument:
        document = self.documents.get_for_hotel(hotel_id, document_id)
        if not document:
            raise not_found("Knowledge document not found")
        target = self.versions.get_version(hotel_id, document_id, version_number)
        if not target:
            raise not_found("Knowledge document version not found")
        document.content = target.content
        document.file_url = target.file_url
        new_version = self.versions.next_version(document.id)
        document.current_version = new_version
        self._snapshot_version(
            document,
            new_version,
            actor_id,
            f"Rollback to version {version_number}",
        )
        self._queue_embeddings(document)
        self.process_document_embeddings(document)
        AuditService(self.db).log(
            hotel_id,
            "knowledge.rollback",
            "knowledge_document",
            document.id,
            actor_id,
            {"version": version_number},
        )
        self.db.commit()
        self.db.refresh(document)
        return document

    def process_pending_embeddings(self, hotel_id: str | None = None) -> list[KnowledgeDocument]:
        if hotel_id:
            candidates = self.documents.list_for_hotel(hotel_id, limit=500)
        else:
            from sqlalchemy import select

            candidates = self.db.execute(
                select(KnowledgeDocument).where(KnowledgeDocument.status == "processing")
            ).scalars().all()
        processed = []
        for document in candidates:
            if document.status != "processing":
                continue
            self.process_document_embeddings(document)
            processed.append(document)
        self.db.commit()
        return processed

    def answer(self, hotel_id: str, text: str) -> str | None:
        query_words = self._words(text)
        if not query_words:
            return None
        best_score = 0
        best_chunk = None
        active_document_ids = {document.id for document in self.documents.list_active(hotel_id)}
        for embedding in self.embeddings.list_for_hotel(hotel_id):
            if embedding.document_id not in active_document_ids:
                continue
            score = len(query_words & self._words(embedding.chunk_text))
            if score > best_score:
                best_score = score
                best_chunk = embedding.chunk_text
        if best_score == 0 or not best_chunk:
            return None
        return best_chunk.strip()

    def _snapshot_version(
        self,
        document: KnowledgeDocument,
        version_number: int,
        actor_id: str | None,
        change_note: str | None,
    ) -> KnowledgeDocumentVersion:
        version = KnowledgeDocumentVersion(
            hotel_id=document.hotel_id,
            document_id=document.id,
            version_number=version_number,
            content=document.content,
            file_url=document.file_url,
            changed_by=actor_id,
            change_note=change_note,
            created_at=utcnow(),
        )
        self.db.add(version)
        self.db.flush()
        return version

    def _queue_embeddings(self, document: KnowledgeDocument) -> None:
        self.embeddings.delete_for_document(document.id)
        document.status = "processing"
        self.db.flush()

    def process_document_embeddings(self, document: KnowledgeDocument) -> None:
        self._rebuild_embeddings(document)
        document.status = "ready"
        self.db.flush()

    def _rebuild_embeddings(self, document: KnowledgeDocument) -> None:
        for index, chunk in enumerate(self._chunks(document.content)):
            self.db.add(
                KnowledgeEmbedding(
                    hotel_id=document.hotel_id,
                    document_id=document.id,
                    chunk_index=index,
                    chunk_text=chunk,
                    embedding=self._simple_embedding(chunk),
                )
            )

    def _chunks(self, text: str, size: int = 800) -> list[str]:
        normalized = " ".join(text.split())
        if not normalized:
            return []
        return [normalized[index : index + size] for index in range(0, len(normalized), size)]

    def _words(self, text: str) -> set[str]:
        return {
            word.strip(".,!?;:()[]{}").lower()
            for word in text.split()
            if len(word.strip(".,!?;:()[]{}")) > 2
        }

    def _simple_embedding(self, text: str) -> list[float]:
        words = sorted(self._words(text))[:32]
        return [float((sum(ord(char) for char in word) % 997) / 997) for word in words]

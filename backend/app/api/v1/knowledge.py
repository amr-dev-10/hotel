from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.knowledge_repository import (
    BotVersionRepository,
    DepartmentConfigRepository,
    FAQRepository,
    HotelLanguageRepository,
    KnowledgeDocumentRepository,
    ServiceFormRepository,
)
from app.schemas.knowledge import (
    BotVersionRead,
    DepartmentConfigRead,
    DepartmentConfigUpsert,
    FAQCreate,
    FAQRead,
    FAQUpdate,
    HotelLanguageRead,
    HotelLanguageUpsert,
    KnowledgeDocumentCreate,
    KnowledgeDocumentRead,
    KnowledgeDocumentUpdate,
    KnowledgeDocumentVersionRead,
    ServiceFormCreate,
    ServiceFormRead,
    ServiceFormUpdate,
)
from app.services.knowledge_service import (
    BotVersionService,
    DepartmentConfigService,
    FAQService,
    HotelLanguageService,
    KnowledgeDocumentService,
    ServiceFormService,
)

router = APIRouter()


@router.get("")
def list_knowledge_documents(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    documents = KnowledgeDocumentRepository(db).list_for_hotel(hotel_id)
    return ok([KnowledgeDocumentRead.model_validate(item).model_dump() for item in documents])


@router.post("")
def create_knowledge_document(
    hotel_id: str,
    payload: KnowledgeDocumentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    document = KnowledgeDocumentService(db).create(hotel_id, payload, current_user.id)
    return ok(KnowledgeDocumentRead.model_validate(document).model_dump())


@router.put("/{document_id}")
def update_knowledge_document(
    hotel_id: str,
    document_id: str,
    payload: KnowledgeDocumentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    document = KnowledgeDocumentService(db).update(hotel_id, document_id, payload, current_user.id)
    return ok(KnowledgeDocumentRead.model_validate(document).model_dump())


@router.get("/{document_id}/versions")
def list_document_versions(
    hotel_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    versions = KnowledgeDocumentService(db).versions_for_document(hotel_id, document_id)
    return ok([KnowledgeDocumentVersionRead.model_validate(item).model_dump() for item in versions])


@router.post("/{document_id}/rollback")
def rollback_document(
    hotel_id: str,
    document_id: str,
    version: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    document = KnowledgeDocumentService(db).rollback(hotel_id, document_id, version, current_user.id)
    return ok(KnowledgeDocumentRead.model_validate(document).model_dump())


@router.post("/embeddings/process")
def process_embeddings(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    processed = KnowledgeDocumentService(db).process_pending_embeddings(hotel_id)
    return ok({"processed": len(processed), "document_ids": [item.id for item in processed]})


@router.delete("/{document_id}")
def delete_knowledge_document(
    hotel_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    KnowledgeDocumentService(db).delete(hotel_id, document_id, current_user.id)
    return ok({"deleted": True, "document_id": document_id})


@router.get("/faqs")
def list_faqs(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    faqs = FAQRepository(db).list_for_hotel(hotel_id)
    return ok([FAQRead.model_validate(item).model_dump() for item in faqs])


@router.post("/faqs")
def create_faq(
    hotel_id: str,
    payload: FAQCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    faq = FAQService(db).create(hotel_id, payload, current_user.id)
    return ok(FAQRead.model_validate(faq).model_dump())


@router.put("/faqs/{faq_id}")
def update_faq(
    hotel_id: str,
    faq_id: str,
    payload: FAQUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    repo = FAQRepository(db)
    faq = repo.get_for_hotel(hotel_id, faq_id)
    if not faq:
        from app.core.exceptions import not_found

        raise not_found("FAQ not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(faq, key, value)
    db.commit()
    db.refresh(faq)
    return ok(FAQRead.model_validate(faq).model_dump())


@router.delete("/faqs/{faq_id}")
def delete_faq(
    hotel_id: str,
    faq_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    repo = FAQRepository(db)
    faq = repo.get_for_hotel(hotel_id, faq_id)
    if not faq:
        from app.core.exceptions import not_found

        raise not_found("FAQ not found")
    faq.is_active = False
    db.commit()
    return ok({"deleted": True, "faq_id": faq_id})


@router.post("/bot-versions")
def publish_bot_version(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.publish")),
) -> dict:
    version = BotVersionService(db).publish_current(hotel_id, current_user.id)
    return ok(BotVersionRead.model_validate(version).model_dump())


@router.get("/bot-versions")
def list_bot_versions(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    versions = BotVersionRepository(db).list_for_hotel(hotel_id)
    return ok([BotVersionRead.model_validate(item).model_dump() for item in versions])


@router.put("/languages")
def upsert_languages(
    hotel_id: str,
    payload: HotelLanguageUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    language = HotelLanguageService(db).upsert(hotel_id, payload)
    return ok(HotelLanguageRead.model_validate(language).model_dump())


@router.get("/languages")
def get_languages(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    language = HotelLanguageRepository(db).get(hotel_id)
    return ok(HotelLanguageRead.model_validate(language).model_dump() if language else None)


@router.post("/department-configs")
def upsert_department_config(
    hotel_id: str,
    payload: DepartmentConfigUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.view")),
) -> dict:
    config = DepartmentConfigService(db).upsert(hotel_id, payload)
    return ok(DepartmentConfigRead.model_validate(config).model_dump())


@router.get("/department-configs")
def list_department_configs(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    configs = DepartmentConfigRepository(db).list_for_hotel(hotel_id)
    return ok([DepartmentConfigRead.model_validate(item).model_dump() for item in configs])


@router.post("/service-forms")
def create_service_form(
    hotel_id: str,
    payload: ServiceFormCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    form = ServiceFormService(db).create(hotel_id, payload, current_user.id)
    return ok(ServiceFormRead.model_validate(form).model_dump())


@router.put("/service-forms/{form_id}")
def update_service_form(
    hotel_id: str,
    form_id: str,
    payload: ServiceFormUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    form = ServiceFormRepository(db).get_for_hotel(hotel_id, form_id)
    if not form:
        from app.core.exceptions import not_found

        raise not_found("Service form not found")
    data = payload.model_dump(exclude_unset=True)
    for key in ("service_name", "service_id", "is_active"):
        if key in data:
            setattr(form, key, data[key])
    if "fields" in data and data["fields"] is not None:
        from app.models.knowledge import ServiceFormField

        for existing in ServiceFormRepository(db).fields_for_form(form.id):
            db.delete(existing)
        db.flush()
        for index, field in enumerate(data["fields"]):
            db.add(
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
    db.commit()
    db.refresh(form)
    return ok(ServiceFormRead.model_validate(form).model_dump())


@router.get("/service-forms")
def list_service_forms(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    forms = ServiceFormRepository(db).list_for_hotel(hotel_id)
    return ok([ServiceFormRead.model_validate(item).model_dump() for item in forms])

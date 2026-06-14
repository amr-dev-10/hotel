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
    ServiceFormRepository,
)
from app.schemas.knowledge import (
    BotVersionRead,
    DepartmentConfigRead,
    DepartmentConfigUpsert,
    FAQCreate,
    FAQRead,
    HotelLanguageRead,
    HotelLanguageUpsert,
    ServiceFormCreate,
    ServiceFormRead,
)
from app.services.knowledge_service import (
    BotVersionService,
    DepartmentConfigService,
    FAQService,
    HotelLanguageService,
    ServiceFormService,
)

router = APIRouter()


@router.get("/faqs")
def list_faqs(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
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


@router.post("/bot-versions")
def publish_bot_version(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    version = BotVersionService(db).publish_current(hotel_id, current_user.id)
    return ok(BotVersionRead.model_validate(version).model_dump())


@router.get("/bot-versions")
def list_bot_versions(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    versions = BotVersionRepository(db).list_for_hotel(hotel_id)
    return ok([BotVersionRead.model_validate(item).model_dump() for item in versions])


@router.put("/languages")
def upsert_languages(
    hotel_id: str,
    payload: HotelLanguageUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    language = HotelLanguageService(db).upsert(hotel_id, payload)
    return ok(HotelLanguageRead.model_validate(language).model_dump())


@router.get("/languages")
def get_languages(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    language = HotelLanguageRepository(db).get(hotel_id)
    return ok(HotelLanguageRead.model_validate(language).model_dump() if language else None)


@router.post("/department-configs")
def upsert_department_config(
    hotel_id: str,
    payload: DepartmentConfigUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
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


@router.get("/service-forms")
def list_service_forms(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    forms = ServiceFormRepository(db).list_for_hotel(hotel_id)
    return ok([ServiceFormRead.model_validate(item).model_dump() for item in forms])

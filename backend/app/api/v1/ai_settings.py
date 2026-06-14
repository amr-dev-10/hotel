from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.schemas.v51 import AISettingsRead, AISettingsTestRead, AISettingsUpdate
from app.services.ai_settings_service import AISettingsService

router = APIRouter()


@router.get("")
def get_ai_settings(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    data = AISettingsService(db).get(hotel_id)
    return ok(AISettingsRead.model_validate(data).model_dump())


@router.put("")
def update_ai_settings(
    hotel_id: str,
    payload: AISettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    data = AISettingsService(db).update(hotel_id, payload)
    return ok(AISettingsRead.model_validate(data).model_dump())


@router.post("/test")
def test_ai_settings(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    data = AISettingsService(db).test(hotel_id)
    return ok(AISettingsTestRead.model_validate(data).model_dump())


@router.delete("")
def delete_ai_settings(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    data = AISettingsService(db).delete(hotel_id)
    return ok(AISettingsRead.model_validate(data).model_dump())

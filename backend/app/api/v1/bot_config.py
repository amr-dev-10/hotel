from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.bot_config import BotConfig
from app.models.user import User
from app.repositories.bot_config_repository import BotConfigRepository
from app.schemas.bot_config import BotConfigRead, BotConfigUpsert
from app.services.defaults import DEFAULT_BOT_MESSAGES, DEFAULT_MAIN_MENU, DEFAULT_SERVICES, DEFAULT_SLA_CONFIG

router = APIRouter()


@router.get("")
def get_bot_config(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    repo = BotConfigRepository(db)
    config = repo.get_for_hotel(hotel_id)
    if not config:
        config = BotConfig(
            hotel_id=hotel_id,
            main_menu=DEFAULT_MAIN_MENU,
            services=DEFAULT_SERVICES,
            messages=DEFAULT_BOT_MESSAGES,
            sla_config=DEFAULT_SLA_CONFIG,
            active_hours={},
            gemini_fallback_enabled=True,
        )
        repo.add(config)
    return ok(BotConfigRead.model_validate(config).model_dump())


@router.put("")
def upsert_bot_config(
    hotel_id: str,
    payload: BotConfigUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("bot.manage")),
) -> dict:
    repo = BotConfigRepository(db)
    config = repo.get_for_hotel(hotel_id)
    if not config:
        config = BotConfig(hotel_id=hotel_id, **payload.model_dump())
        repo.add(config, commit=False)
    else:
        for key, value in payload.model_dump().items():
            setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return ok(BotConfigRead.model_validate(config).model_dump())

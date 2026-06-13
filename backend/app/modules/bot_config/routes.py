from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.bot_config.models import BotConfig
from app.modules.bot_config.schemas import BotConfigRead, BotConfigUpdate
from app.modules.hotel.dependencies import ensure_hotel_scope

router = APIRouter(prefix="/hotels/{hotel_id}/bot-config", tags=["bot config"])


def _config_to_read(config: BotConfig) -> BotConfigRead:
    return BotConfigRead(
        id=config.id,
        hotel_id=config.tenant_id,
        main_menu=config.main_menu,
        services=config.services,
        messages=config.messages,
        default_sla_minutes=config.default_sla_minutes,
        per_department_sla=config.per_department_sla,
        active_hours=config.active_hours,
    )


def _get_or_create_config(db: Session, hotel_id: str) -> BotConfig:
    config = db.scalar(select(BotConfig).where(BotConfig.tenant_id == hotel_id))
    if config is None:
        config = BotConfig(tenant_id=hotel_id)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("", response_model=BotConfigRead)
def get_bot_config(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> BotConfigRead:
    ensure_hotel_scope(hotel_id, context)
    return _config_to_read(_get_or_create_config(db, hotel_id))


@router.put("", response_model=BotConfigRead)
def update_bot_config(
    hotel_id: str,
    payload: BotConfigUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> BotConfigRead:
    ensure_hotel_scope(hotel_id, context)
    config = _get_or_create_config(db, hotel_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(config, key, value)
    db.commit()
    db.refresh(config)
    return _config_to_read(config)

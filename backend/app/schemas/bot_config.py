from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class BotConfigUpsert(BaseModel):
    main_menu: list[dict] = Field(default_factory=list)
    services: list[dict] = Field(default_factory=list)
    messages: dict = Field(default_factory=dict)
    sla_config: dict = Field(default_factory=dict)
    active_hours: dict = Field(default_factory=dict)
    gemini_fallback_enabled: bool = True


class BotConfigRead(ORMModel):
    id: str
    hotel_id: str
    main_menu: list[dict]
    services: list[dict]
    messages: dict
    sla_config: dict
    active_hours: dict
    gemini_fallback_enabled: bool
    active_version: int

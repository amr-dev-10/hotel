from typing import Any

from pydantic import BaseModel, Field


class BotConfigUpdate(BaseModel):
    main_menu: dict[str, Any] | None = None
    services: dict[str, Any] | None = None
    messages: dict[str, Any] | None = None
    default_sla_minutes: int | None = Field(default=None, ge=1)
    per_department_sla: dict[str, Any] | None = None
    active_hours: dict[str, Any] | None = None


class BotConfigRead(BaseModel):
    id: str
    hotel_id: str
    main_menu: dict[str, Any]
    services: dict[str, Any]
    messages: dict[str, Any]
    default_sla_minutes: int
    per_department_sla: dict[str, Any]
    active_hours: dict[str, Any]

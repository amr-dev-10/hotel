from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class CursorMeta(BaseModel):
    total: int | None = None
    cursor: str | None = None
    limit: int = 20


class APIEnvelope(BaseModel):
    success: bool = True
    data: Any = None
    meta: dict[str, Any] | None = None

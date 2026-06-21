from typing import Any, Generic, TypeVar

from pydantic import BaseModel, ConfigDict

T = TypeVar("T")


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


class CursorPageMeta(BaseModel):
    next_cursor: str | None = None
    has_more: bool = False
    limit: int = 50


class CursorPage(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    has_more: bool = False
    limit: int = 50

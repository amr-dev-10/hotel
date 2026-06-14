from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class DepartmentCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    key: str = Field(min_length=2, max_length=80)
    description: str | None = None
    keywords: list[str] = Field(default_factory=list)
    resolution_time: str | None = None
    is_active: bool = True
    sort_order: int = 0


class DepartmentRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    key: str
    description: str | None = None
    keywords: list[str]
    resolution_time: str | None = None
    is_active: bool
    sort_order: int

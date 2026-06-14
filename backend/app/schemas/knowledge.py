from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class FAQCreate(BaseModel):
    question: str = Field(min_length=2, max_length=255)
    answer: str = Field(min_length=2)
    category: str | None = None
    is_active: bool = True


class FAQRead(ORMModel):
    id: str
    hotel_id: str
    question: str
    answer: str
    category: str | None = None
    is_active: bool


class BotVersionRead(ORMModel):
    id: str
    hotel_id: str
    version: int
    config_json: dict
    published_by: str | None = None


class HotelLanguageUpsert(BaseModel):
    default_language: str = "en"
    supported_languages: list[str] = Field(default_factory=lambda: ["en"])


class HotelLanguageRead(ORMModel):
    hotel_id: str
    default_language: str
    supported_languages: list[str]


class DepartmentConfigUpsert(BaseModel):
    department_id: str
    keywords: list[str] = Field(default_factory=list)
    sla_minutes: int = 20
    auto_assignment_enabled: bool = True


class DepartmentConfigRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str
    keywords: list[str]
    sla_minutes: int
    auto_assignment_enabled: bool


class ServiceFormCreate(BaseModel):
    service_name: str = Field(min_length=2, max_length=160)
    fields: list[dict] = Field(default_factory=list)


class ServiceFormRead(ORMModel):
    id: str
    hotel_id: str
    service_name: str
    is_active: bool

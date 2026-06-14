from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class FAQCreate(BaseModel):
    question: str = Field(min_length=2, max_length=255)
    answer: str = Field(min_length=2)
    category: str | None = None
    language: str = "en"
    is_active: bool = True
    sort_order: int = 0


class FAQUpdate(BaseModel):
    question: str | None = None
    answer: str | None = None
    category: str | None = None
    language: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class FAQRead(ORMModel):
    id: str
    hotel_id: str
    question: str
    answer: str
    category: str | None = None
    language: str
    is_active: bool
    sort_order: int


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
    assignment_strategy: str = "round_robin"


class DepartmentConfigRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str
    keywords: list[str]
    sla_minutes: int
    auto_assignment_enabled: bool
    assignment_strategy: str


class ServiceFormCreate(BaseModel):
    service_name: str = Field(min_length=2, max_length=160)
    service_id: str | None = None
    fields: list[dict] = Field(default_factory=list)


class ServiceFormUpdate(BaseModel):
    service_name: str | None = None
    service_id: str | None = None
    is_active: bool | None = None
    fields: list[dict] | None = None


class ServiceFormRead(ORMModel):
    id: str
    hotel_id: str
    service_name: str
    service_id: str | None = None
    is_active: bool


class KnowledgeDocumentCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    content: str = Field(min_length=2)
    category: str | None = None
    file_url: str | None = None
    language: str = "en"
    is_active: bool = True
    status: str = "ready"
    change_note: str | None = None


class KnowledgeDocumentUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    category: str | None = None
    file_url: str | None = None
    language: str | None = None
    is_active: bool | None = None
    status: str | None = None
    change_note: str | None = None


class KnowledgeDocumentRead(ORMModel):
    id: str
    hotel_id: str
    title: str
    content: str
    category: str | None = None
    file_url: str | None = None
    language: str
    is_active: bool
    status: str
    current_version: int


class KnowledgeDocumentVersionRead(ORMModel):
    id: str
    hotel_id: str
    document_id: str
    version_number: int
    content: str
    file_url: str | None = None
    changed_by: str | None = None
    change_note: str | None = None


class KnowledgeEmbeddingRead(ORMModel):
    id: str
    hotel_id: str
    document_id: str
    chunk_index: int
    chunk_text: str

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class WhatsAppAccountCreate(BaseModel):
    business_name: str = Field(min_length=2, max_length=180)
    phone_number: str | None = None
    phone_number_id: str = Field(min_length=2, max_length=80)
    waba_id: str | None = None
    access_token: str | None = None
    access_token_encrypted: str | None = None
    webhook_verify_token: str | None = None
    status: str = "active"


class WhatsAppAccountRead(ORMModel):
    id: str
    hotel_id: str
    business_name: str
    phone_number: str | None = None
    phone_number_id: str
    waba_id: str | None = None
    webhook_verify_token: str | None = None
    status: str


class WhatsAppTemplateCreate(BaseModel):
    template_name: str = Field(min_length=2, max_length=120)
    template_type: str = "promotional"
    language: str = "en"
    status: str = "pending"
    meta_template_id: str | None = None
    header_params: list[dict] = Field(default_factory=list)
    body_params: list[dict] = Field(default_factory=list)


class WhatsAppTemplateRead(ORMModel):
    id: str
    hotel_id: str
    template_name: str
    template_type: str
    language: str
    status: str
    meta_template_id: str | None = None
    header_params: list[dict]
    body_params: list[dict]


class WhatsAppConversationRead(ORMModel):
    id: str
    hotel_id: str
    guest_id: str | None = None
    phone: str
    status: str
    last_message_at: datetime | None = None


class WhatsAppMessageRead(ORMModel):
    id: str
    hotel_id: str
    conversation_id: str
    direction: str
    message_type: str
    message_text: str | None = None
    meta_message_id: str | None = None
    status: str
    created_at: datetime

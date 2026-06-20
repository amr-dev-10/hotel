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
    token_expires_at: datetime | None = None
    onboarding_step: str = "connected"


class WhatsAppAccountRead(ORMModel):
    id: str
    hotel_id: str
    business_name: str
    phone_number: str | None = None
    phone_number_id: str
    waba_id: str | None = None
    webhook_verify_token: str | None = None
    status: str
    token_expires_at: datetime | None = None
    onboarding_step: str
    connected_at: datetime | None = None
    last_verified_at: datetime | None = None


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
    priority: str
    assigned_staff_id: str | None = None
    assigned_at: datetime | None = None
    resolved_at: datetime | None = None
    resolved_by: str | None = None
    unread_count: int
    last_message_at: datetime | None = None

class WhatsAppConversationUpdateRequest(BaseModel):
    status: str | None = None
    priority: str | None = None
    assigned_staff_id: str | None = None


class WhatsAppMessageRead(ORMModel):
    id: str
    hotel_id: str
    conversation_id: str
    reservation_id: str | None = None
    direction: str
    message_type: str
    message_text: str | None = None
    meta_message_id: str | None = None
    status: str
    created_at: datetime


class WhatsAppHealthRead(ORMModel):
    id: str
    hotel_id: str
    whatsapp_account_id: str
    last_message_sent_at: datetime | None = None
    last_message_received_at: datetime | None = None
    last_webhook_received_at: datetime | None = None
    token_status: str
    webhook_status: str
    error_count_24h: int
    last_error_message: str | None = None
    checked_at: datetime | None = None


class WhatsAppUsageRead(ORMModel):
    id: str
    hotel_id: str
    year_month: str
    messages_sent: int
    messages_received: int
    template_sent: int
    media_sent: int
    api_calls: int
    estimated_cost: float
    updated_at: datetime


class LiveChatSessionRead(ORMModel):
    id: str
    hotel_id: str
    guest_id: str | None = None
    guest_phone: str
    assigned_staff_id: str | None = None
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    ended_by: str | None = None


class LiveChatSendRequest(BaseModel):
    message: str = Field(min_length=1)


class WhatsAppOnboardingStart(BaseModel):
    business_name: str = Field(min_length=2, max_length=180)
    phone_number: str | None = None
    phone_number_id: str = Field(min_length=2, max_length=80)
    waba_id: str | None = None


class WhatsAppOnboardingVerify(BaseModel):
    access_token: str = Field(min_length=2)
    token_expires_at: datetime | None = None


class WhatsAppTestMessageRequest(BaseModel):
    to_phone: str = Field(min_length=5)
    message: str = "Arcadia WhatsApp test message"


class ConversationWindowRead(ORMModel):
    id: str
    hotel_id: str
    guest_phone: str
    category: str
    opened_at: datetime
    closes_at: datetime
    message_count: int
    estimated_cost: float
    meta_conversation_id: str | None = None


class WhatsAppMessageSendRequest(BaseModel):
    message: str = Field(min_length=1)

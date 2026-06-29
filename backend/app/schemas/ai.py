from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class AIContext(BaseModel):
    hotel: dict[str, Any] = Field(default_factory=dict)
    guest: dict[str, Any] | None = None
    reservation: dict[str, Any] | None = None
    room: dict[str, Any] | None = None
    conversation: dict[str, Any] | None = None
    messages: list[dict[str, Any]] = Field(default_factory=list)
    open_tickets: list[dict[str, Any]] = Field(default_factory=list)
    knowledge: list[dict[str, Any]] = Field(default_factory=list)
    conversation_summary: str | None = None
    guest_preferences: dict[str, Any] | None = None
    language: str = "en"
    conversation_id: str | None = None
    room_id: str | None = None


class AIChatResponse(BaseModel):
    content: str
    model: str
    provider: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    finish_reason: str = "stop"


class AITicketSuggestion(BaseModel):
    title: str = "Guest request"
    description: str = "Guest request requires staff attention."
    department_key: str | None = None
    task_category: str | None = None
    priority: int = Field(default=2, ge=1, le=5)


class AIDecision(BaseModel):
    intent: str = "unknown"
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    sentiment: str = "neutral"
    ticket_required: bool = False
    reply_required: bool = False
    ticket: AITicketSuggestion | None = None
    reply: str | None = None
    reason: str = ""
    parse_error: bool = False


class AIAction(BaseModel):
    reply_action: str = "none"
    ticket_action: str = "none"
    escalation_action: str = "none"
    escalation_reason: str | None = None


class AIExecutionResult(BaseModel):
    reply_sent: bool = False
    reply_text: str | None = None
    outbound_message_id: str | None = None
    suggested_reply: str | None = None
    ticket_created: bool = False
    ticket_id: str | None = None
    escalated: bool = False
    escalation_ticket_id: str | None = None


class AIDebugStep(BaseModel):
    step: str
    status: str = "success"
    details: dict[str, Any] = Field(default_factory=dict)
    error: str | None = None


class AIProcessingResult(BaseModel):
    processed: bool = True
    decision: AIDecision | None = None
    action: AIAction | None = None
    reply_sent: bool = False
    reply_text: str | None = None
    outbound_message_id: str | None = None
    suggested_reply: str | None = None
    ticket_created: bool = False
    ticket_id: str | None = None
    escalated: bool = False
    escalation_ticket_id: str | None = None
    latency_ms: int = 0
    usage_log_id: str | None = None
    error: str | None = None
    debug_steps: list[AIDebugStep] = Field(default_factory=list)


class AIChatRequest(BaseModel):
    conversation_id: str
    message: str = Field(min_length=1, max_length=4000)


class AISuggestReplyRequest(BaseModel):
    conversation_id: str
    staff_context: str | None = Field(default=None, max_length=2000)


class AIGenerateTicketRequest(BaseModel):
    conversation_id: str
    message: str = Field(min_length=1, max_length=4000)


class AISummarizeRequest(BaseModel):
    conversation_id: str


class AISuggestReplyRead(BaseModel):
    reply: str
    intent: str
    confidence: float
    latency_ms: int = 0


class AIAnalyticsSummary(BaseModel):
    total_requests: int = 0
    total_tokens: int = 0
    total_cost: float = 0.0
    avg_latency_ms: float = 0.0
    escalation_rate: float = 0.0
    auto_reply_rate: float = 0.0
    intent_distribution: dict[str, int] = Field(default_factory=dict)


class AIUsageLogRead(ORMModel):
    id: str
    hotel_id: str
    conversation_id: str | None = None
    provider: str
    model: str
    request_type: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    estimated_cost_usd: float
    intent_detected: str | None = None
    confidence: float | None = None
    sentiment: str | None = None
    ticket_created: bool
    ticket_id: str | None = None
    escalated: bool
    reply_sent: bool
    error: str | None = None
    created_at: datetime


class AIToolExecutionLogRead(ORMModel):
    id: str
    hotel_id: str
    usage_log_id: str | None = None
    tool_name: str
    tool_input: dict[str, Any] | None = None
    tool_output: dict[str, Any] | None = None
    status: str
    executed_by: str
    error: str | None = None
    created_at: datetime


class AIDebugLogRead(AIUsageLogRead):
    steps: list[AIToolExecutionLogRead] = Field(default_factory=list)


class AIPromptCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    prompt_type: str = Field(default="system", max_length=30)
    content: str = Field(min_length=2)
    version: int = Field(default=1, ge=1)
    is_active: bool = True


class AIPromptUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    prompt_type: str | None = Field(default=None, max_length=30)
    content: str | None = Field(default=None, min_length=2)
    version: int | None = Field(default=None, ge=1)
    is_active: bool | None = None


class AIPromptRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    prompt_type: str
    content: str
    version: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

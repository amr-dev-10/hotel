from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class AIConversationSummary(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_conversation_summaries"
    __table_args__ = (
        UniqueConstraint("hotel_id", "conversation_id", name="uq_ai_summary_conversation"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("whatsapp_conversations.id"), index=True)
    summary: Mapped[str] = mapped_column(Text)
    message_count: Mapped[int] = mapped_column(Integer, default=0)
    last_message_id: Mapped[str | None] = mapped_column(String(36))
    model_used: Mapped[str | None] = mapped_column(String(100))


class AIUsageLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_usage_logs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    conversation_id: Mapped[str | None] = mapped_column(
        ForeignKey("whatsapp_conversations.id"),
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(100))
    request_type: Mapped[str] = mapped_column(String(30), index=True)
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    intent_detected: Mapped[str | None] = mapped_column(String(50), index=True)
    confidence: Mapped[float | None] = mapped_column(Float)
    sentiment: Mapped[str | None] = mapped_column(String(20), index=True)
    ticket_created: Mapped[bool] = mapped_column(Boolean, default=False)
    ticket_id: Mapped[str | None] = mapped_column(String(36), index=True)
    escalated: Mapped[bool] = mapped_column(Boolean, default=False)
    reply_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text)


class AIToolExecutionLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_tool_execution_logs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    usage_log_id: Mapped[str | None] = mapped_column(ForeignKey("ai_usage_logs.id"), index=True)
    tool_name: Mapped[str] = mapped_column(String(50), index=True)
    tool_input: Mapped[dict | None] = mapped_column(JSON)
    tool_output: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="success", index=True)
    executed_by: Mapped[str] = mapped_column(String(20), default="system")
    error: Mapped[str | None] = mapped_column(Text)


class AIPrompt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_prompts"
    __table_args__ = (
        UniqueConstraint("hotel_id", "name", "version", name="uq_ai_prompts_name_version"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(100), index=True)
    prompt_type: Mapped[str] = mapped_column(String(30), default="system", index=True)
    content: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)

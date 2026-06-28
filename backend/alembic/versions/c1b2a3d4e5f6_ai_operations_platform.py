"""ai operations platform

Revision ID: c1b2a3d4e5f6
Revises: 7f4b0f9e2d2c
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c1b2a3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "7f4b0f9e2d2c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_conversation_summaries",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("message_count", sa.Integer(), nullable=False),
        sa.Column("last_message_id", sa.String(length=36), nullable=True),
        sa.Column("model_used", sa.String(length=100), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["whatsapp_conversations.id"]),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "conversation_id", name="uq_ai_summary_conversation"),
    )
    op.create_index(op.f("ix_ai_conversation_summaries_conversation_id"), "ai_conversation_summaries", ["conversation_id"])
    op.create_index(op.f("ix_ai_conversation_summaries_hotel_id"), "ai_conversation_summaries", ["hotel_id"])

    op.create_table(
        "ai_usage_logs",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("conversation_id", sa.String(length=36), nullable=True),
        sa.Column("provider", sa.String(length=30), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("request_type", sa.String(length=30), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False),
        sa.Column("completion_tokens", sa.Integer(), nullable=False),
        sa.Column("total_tokens", sa.Integer(), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False),
        sa.Column("intent_detected", sa.String(length=50), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("sentiment", sa.String(length=20), nullable=True),
        sa.Column("ticket_created", sa.Boolean(), nullable=False),
        sa.Column("ticket_id", sa.String(length=36), nullable=True),
        sa.Column("escalated", sa.Boolean(), nullable=False),
        sa.Column("reply_sent", sa.Boolean(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["whatsapp_conversations.id"]),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_usage_logs_conversation_id"), "ai_usage_logs", ["conversation_id"])
    op.create_index(op.f("ix_ai_usage_logs_hotel_id"), "ai_usage_logs", ["hotel_id"])
    op.create_index(op.f("ix_ai_usage_logs_intent_detected"), "ai_usage_logs", ["intent_detected"])
    op.create_index(op.f("ix_ai_usage_logs_request_type"), "ai_usage_logs", ["request_type"])
    op.create_index(op.f("ix_ai_usage_logs_sentiment"), "ai_usage_logs", ["sentiment"])
    op.create_index(op.f("ix_ai_usage_logs_ticket_id"), "ai_usage_logs", ["ticket_id"])

    op.create_table(
        "ai_tool_execution_logs",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("usage_log_id", sa.String(length=36), nullable=True),
        sa.Column("tool_name", sa.String(length=50), nullable=False),
        sa.Column("tool_input", sa.JSON(), nullable=True),
        sa.Column("tool_output", sa.JSON(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("executed_by", sa.String(length=20), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.ForeignKeyConstraint(["usage_log_id"], ["ai_usage_logs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ai_tool_execution_logs_hotel_id"), "ai_tool_execution_logs", ["hotel_id"])
    op.create_index(op.f("ix_ai_tool_execution_logs_status"), "ai_tool_execution_logs", ["status"])
    op.create_index(op.f("ix_ai_tool_execution_logs_tool_name"), "ai_tool_execution_logs", ["tool_name"])
    op.create_index(op.f("ix_ai_tool_execution_logs_usage_log_id"), "ai_tool_execution_logs", ["usage_log_id"])

    op.create_table(
        "ai_prompts",
        sa.Column("hotel_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("prompt_type", sa.String(length=30), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["hotel_id"], ["hotels.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hotel_id", "name", "version", name="uq_ai_prompts_name_version"),
    )
    op.create_index(op.f("ix_ai_prompts_hotel_id"), "ai_prompts", ["hotel_id"])
    op.create_index(op.f("ix_ai_prompts_is_active"), "ai_prompts", ["is_active"])
    op.create_index(op.f("ix_ai_prompts_name"), "ai_prompts", ["name"])
    op.create_index(op.f("ix_ai_prompts_prompt_type"), "ai_prompts", ["prompt_type"])


def downgrade() -> None:
    op.drop_index(op.f("ix_ai_prompts_prompt_type"), table_name="ai_prompts")
    op.drop_index(op.f("ix_ai_prompts_name"), table_name="ai_prompts")
    op.drop_index(op.f("ix_ai_prompts_is_active"), table_name="ai_prompts")
    op.drop_index(op.f("ix_ai_prompts_hotel_id"), table_name="ai_prompts")
    op.drop_table("ai_prompts")
    op.drop_index(op.f("ix_ai_tool_execution_logs_usage_log_id"), table_name="ai_tool_execution_logs")
    op.drop_index(op.f("ix_ai_tool_execution_logs_tool_name"), table_name="ai_tool_execution_logs")
    op.drop_index(op.f("ix_ai_tool_execution_logs_status"), table_name="ai_tool_execution_logs")
    op.drop_index(op.f("ix_ai_tool_execution_logs_hotel_id"), table_name="ai_tool_execution_logs")
    op.drop_table("ai_tool_execution_logs")
    op.drop_index(op.f("ix_ai_usage_logs_ticket_id"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_sentiment"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_request_type"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_intent_detected"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_hotel_id"), table_name="ai_usage_logs")
    op.drop_index(op.f("ix_ai_usage_logs_conversation_id"), table_name="ai_usage_logs")
    op.drop_table("ai_usage_logs")
    op.drop_index(op.f("ix_ai_conversation_summaries_hotel_id"), table_name="ai_conversation_summaries")
    op.drop_index(op.f("ix_ai_conversation_summaries_conversation_id"), table_name="ai_conversation_summaries")
    op.drop_table("ai_conversation_summaries")

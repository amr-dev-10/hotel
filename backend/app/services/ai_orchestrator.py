import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.vault import Vault
from app.integrations.ai.factory import get_ai_provider
from app.models.ai_models import AIConversationSummary
from app.schemas.ai import (
    AIChatResponse,
    AIDecision,
    AIProcessingResult,
    AISuggestReplyRead,
    AITicketSuggestion,
)
from app.services.ai_analytics_service import AIAnalyticsService
from app.services.ai_context_builder import AIContextBuilder
from app.services.ai_decision_engine import AIDecisionEngine
from app.services.ai_knowledge_loader import AIKnowledgeLoader
from app.services.ai_request_builder import AIRequestBuilder
from app.services.ai_response_parser import AIResponseParser
from app.services.ai_settings_service import AISettingsService
from app.services.ai_tool_executor import AIToolExecutor


class AIOrchestratorService:
    @staticmethod
    async def process_message(
        db: Session,
        hotel_id: str,
        conversation_id: str,
        message: str,
        message_id: str | None = None,
        source: str = "whatsapp",
    ) -> AIProcessingResult:
        try:
            config, decision, response, latency_ms, context = AIOrchestratorService._decide(
                db,
                hotel_id,
                conversation_id,
                message,
                source=source,
            )
            action = AIDecisionEngine.evaluate(
                decision,
                config,
                has_open_ticket=bool(context.open_tickets),
            )
            usage_log = AIAnalyticsService.log_request(
                db,
                hotel_id=hotel_id,
                conversation_id=conversation_id,
                provider=response.provider,
                model=response.model,
                request_type="chat",
                prompt_tokens=response.prompt_tokens,
                completion_tokens=response.completion_tokens,
                latency_ms=latency_ms,
                intent=decision.intent,
                confidence=decision.confidence,
                sentiment=decision.sentiment,
                commit=False,
            )
            execution = AIToolExecutor.execute(
                db,
                hotel_id,
                action,
                decision,
                context,
                usage_log.id,
                config,
            )
            usage_log.ticket_created = execution.ticket_created
            usage_log.ticket_id = execution.ticket_id or execution.escalation_ticket_id
            usage_log.escalated = execution.escalated
            usage_log.reply_sent = execution.reply_sent
            db.commit()
            return AIProcessingResult(
                processed=True,
                decision=decision,
                action=action,
                reply_sent=execution.reply_sent,
                reply_text=execution.reply_text,
                suggested_reply=execution.suggested_reply,
                ticket_created=execution.ticket_created,
                ticket_id=execution.ticket_id,
                escalated=execution.escalated,
                escalation_ticket_id=execution.escalation_ticket_id,
                latency_ms=latency_ms,
                usage_log_id=usage_log.id,
            )
        except Exception as exc:
            db.rollback()
            AIOrchestratorService._log_error(
                db,
                hotel_id,
                conversation_id,
                request_type="chat",
                error=str(exc),
            )
            return AIProcessingResult(processed=False, error=str(exc))

    @staticmethod
    async def generate_reply(
        db: Session,
        hotel_id: str,
        conversation_id: str,
        staff_context: str | None = None,
    ) -> AISuggestReplyRead:
        config, decision, response, latency_ms, _context = AIOrchestratorService._decide(
            db,
            hotel_id,
            conversation_id,
            "Generate a helpful staff-reviewed reply for the latest guest message.",
            staff_context=staff_context,
            source="dashboard",
        )
        AIAnalyticsService.log_request(
            db,
            hotel_id=hotel_id,
            conversation_id=conversation_id,
            provider=response.provider,
            model=response.model,
            request_type="suggest_reply",
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            latency_ms=latency_ms,
            intent=decision.intent,
            confidence=decision.confidence,
            sentiment=decision.sentiment,
            commit=True,
        )
        return AISuggestReplyRead(
            reply=decision.reply or "A staff member will assist you shortly.",
            intent=decision.intent,
            confidence=decision.confidence,
            latency_ms=latency_ms,
        )

    @staticmethod
    async def generate_ticket(
        db: Session,
        hotel_id: str,
        conversation_id: str,
        message: str,
    ) -> AITicketSuggestion:
        _config, decision, response, latency_ms, _context = AIOrchestratorService._decide(
            db,
            hotel_id,
            conversation_id,
            message,
            source="dashboard",
        )
        AIAnalyticsService.log_request(
            db,
            hotel_id=hotel_id,
            conversation_id=conversation_id,
            provider=response.provider,
            model=response.model,
            request_type="generate_ticket",
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            latency_ms=latency_ms,
            intent=decision.intent,
            confidence=decision.confidence,
            sentiment=decision.sentiment,
            commit=True,
        )
        return decision.ticket or AITicketSuggestion(
            title="Guest request",
            description=decision.reason or message,
        )

    @staticmethod
    async def summarize_conversation(
        db: Session,
        hotel_id: str,
        conversation_id: str,
    ) -> str:
        config = AISettingsService(db).get(hotel_id)
        context = AIContextBuilder.build_context(
            db,
            hotel_id,
            conversation_id,
            int(config.get("max_context_messages") or 20),
        )
        provider = AIOrchestratorService._provider(db, hotel_id, config)
        prompt = "Summarize this hotel guest conversation for staff in 3 concise bullets."
        messages = [
            {"role": "system", "content": "You write concise hotel operations summaries."},
            {"role": "user", "content": f"{prompt}\n\n{context.model_dump_json()}"},
        ]
        started = time.perf_counter()
        raw = provider.chat(messages, temperature=0.2, max_tokens=500)
        latency_ms = int((time.perf_counter() - started) * 1000)
        response = AIChatResponse.model_validate(raw)
        summary = response.content.strip()
        existing = db.execute(
            select(AIConversationSummary).where(
                AIConversationSummary.hotel_id == hotel_id,
                AIConversationSummary.conversation_id == conversation_id,
            )
        ).scalar_one_or_none()
        last_message_id = context.messages[-1]["id"] if context.messages else None
        if existing:
            existing.summary = summary
            existing.message_count = len(context.messages)
            existing.last_message_id = last_message_id
            existing.model_used = response.model
        else:
            db.add(
                AIConversationSummary(
                    hotel_id=hotel_id,
                    conversation_id=conversation_id,
                    summary=summary,
                    message_count=len(context.messages),
                    last_message_id=last_message_id,
                    model_used=response.model,
                )
            )
        AIAnalyticsService.log_request(
            db,
            hotel_id=hotel_id,
            conversation_id=conversation_id,
            provider=response.provider,
            model=response.model,
            request_type="summarize",
            prompt_tokens=response.prompt_tokens,
            completion_tokens=response.completion_tokens,
            latency_ms=latency_ms,
            commit=False,
        )
        db.commit()
        return summary

    @staticmethod
    def _decide(
        db: Session,
        hotel_id: str,
        conversation_id: str,
        message: str,
        staff_context: str | None = None,
        source: str = "whatsapp",
    ):
        config = AISettingsService(db).get(hotel_id)
        context = AIContextBuilder.build_context(
            db,
            hotel_id,
            conversation_id,
            int(config.get("max_context_messages") or 20),
        )
        context.language = config.get("language") or "en"
        context.knowledge = AIKnowledgeLoader.load_relevant_knowledge(db, hotel_id, message)
        provider = AIOrchestratorService._provider(db, hotel_id, config)
        messages = AIRequestBuilder.build_chat_messages(config, context, message, staff_context)
        started = time.perf_counter()
        raw_response = provider.chat(
            messages,
            temperature=float(config.get("temperature") or 0.3),
            max_tokens=1200,
            response_format="json_object",
        )
        latency_ms = int((time.perf_counter() - started) * 1000)
        response = AIChatResponse.model_validate(raw_response)
        decision = AIResponseParser.parse(response.model_dump())
        return config, decision, response, latency_ms, context

    @staticmethod
    def _provider(db: Session, hotel_id: str, config: dict):
        provider_name = config.get("provider") or "local"
        api_key = Vault(db).retrieve(hotel_id, f"ai:{provider_name}:api_key")
        return get_ai_provider(provider_name, api_key=api_key, model=config.get("model"))

    @staticmethod
    def _log_error(
        db: Session,
        hotel_id: str,
        conversation_id: str | None,
        request_type: str,
        error: str,
    ) -> None:
        try:
            config = AISettingsService(db).get(hotel_id)
            AIAnalyticsService.log_request(
                db,
                hotel_id=hotel_id,
                conversation_id=conversation_id,
                provider=config.get("provider") or "local",
                model=config.get("model") or "unknown",
                request_type=request_type,
                prompt_tokens=0,
                completion_tokens=0,
                latency_ms=0,
                error=error,
                commit=True,
            )
        except Exception:
            db.rollback()

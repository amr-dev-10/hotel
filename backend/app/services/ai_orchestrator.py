import logging
import time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.vault import Vault
from app.integrations.ai.factory import get_ai_provider
from app.models.ai_models import AIConversationSummary
from app.schemas.ai import (
    AIChatResponse,
    AIDecision,
    AIDebugStep,
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


logger = logging.getLogger(__name__)


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
        debug_steps: list[AIDebugStep] = []
        try:
            AIOrchestratorService._debug_step(
                debug_steps,
                "process_start",
                {
                    "source": source,
                    "message_id": message_id,
                    "message_length": len(message or ""),
                },
                hotel_id=hotel_id,
                conversation_id=conversation_id,
            )
            config, decision, response, latency_ms, context = AIOrchestratorService._decide(
                db,
                hotel_id,
                conversation_id,
                message,
                source=source,
                debug_steps=debug_steps,
            )
            action = AIDecisionEngine.evaluate(
                decision,
                config,
                has_open_ticket=bool(context.open_tickets),
            )
            AIOrchestratorService._debug_step(
                debug_steps,
                "action_selected",
                {
                    "action": action.model_dump(),
                    "has_open_ticket": bool(context.open_tickets),
                },
                hotel_id=hotel_id,
                conversation_id=conversation_id,
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
            AIOrchestratorService._debug_step(
                debug_steps,
                "tool_execution_completed",
                execution.model_dump(),
                hotel_id=hotel_id,
                conversation_id=conversation_id,
            )
            AIOrchestratorService._persist_debug_steps(db, hotel_id, usage_log.id, debug_steps)
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
                outbound_message_id=execution.outbound_message_id,
                suggested_reply=execution.suggested_reply,
                ticket_created=execution.ticket_created,
                ticket_id=execution.ticket_id,
                escalated=execution.escalated,
                escalation_ticket_id=execution.escalation_ticket_id,
                latency_ms=latency_ms,
                usage_log_id=usage_log.id,
                debug_steps=debug_steps,
            )
        except Exception as exc:
            db.rollback()
            AIOrchestratorService._debug_step(
                debug_steps,
                "process_failed",
                {"source": source, "message_id": message_id},
                status="error",
                error=str(exc),
                hotel_id=hotel_id,
                conversation_id=conversation_id,
            )
            usage_log = AIOrchestratorService._log_error(
                db,
                hotel_id,
                conversation_id,
                request_type="chat",
                error=str(exc),
                commit=False,
            )
            if usage_log:
                AIOrchestratorService._persist_debug_steps(db, hotel_id, usage_log.id, debug_steps)
                db.commit()
            return AIProcessingResult(
                processed=False,
                error=str(exc),
                usage_log_id=usage_log.id if usage_log else None,
                debug_steps=debug_steps,
            )

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
        debug_steps: list[AIDebugStep] | None = None,
    ):
        config = AISettingsService(db).get(hotel_id)
        AIOrchestratorService._debug_step(
            debug_steps,
            "settings_loaded",
            AIOrchestratorService._debug_config(config),
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
        context = AIContextBuilder.build_context(
            db,
            hotel_id,
            conversation_id,
            int(config.get("max_context_messages") or 20),
        )
        context.language = config.get("language") or "en"
        AIOrchestratorService._debug_step(
            debug_steps,
            "context_built",
            {
                "message_count": len(context.messages),
                "open_ticket_count": len(context.open_tickets),
                "has_guest": bool(context.guest),
                "has_reservation": bool(context.reservation),
                "has_room": bool(context.room),
            },
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
        context.knowledge = AIKnowledgeLoader.load_relevant_knowledge(db, hotel_id, message)
        AIOrchestratorService._debug_step(
            debug_steps,
            "knowledge_loaded",
            {"knowledge_count": len(context.knowledge)},
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
        provider = AIOrchestratorService._provider(db, hotel_id, config)
        AIOrchestratorService._debug_step(
            debug_steps,
            "provider_selected",
            {
                "provider": getattr(provider, "provider_name", config.get("provider") or "local"),
                "model": config.get("model"),
            },
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
        messages = AIRequestBuilder.build_chat_messages(config, context, message, staff_context)
        AIOrchestratorService._debug_step(
            debug_steps,
            "request_built",
            {
                "message_count": len(messages),
                "source": source,
                "staff_context_present": bool(staff_context),
            },
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
        started = time.perf_counter()
        try:
            raw_response = provider.chat(
                messages,
                temperature=float(config.get("temperature") or 0.3),
                max_tokens=1200,
                response_format="json_object",
            )
        except Exception as exc:
            AIOrchestratorService._debug_step(
                debug_steps,
                "provider_chat_failed",
                {"provider": config.get("provider") or "local", "model": config.get("model")},
                status="error",
                error=str(exc),
                hotel_id=hotel_id,
                conversation_id=conversation_id,
            )
            raise
        latency_ms = int((time.perf_counter() - started) * 1000)
        response = AIChatResponse.model_validate(raw_response)
        AIOrchestratorService._debug_step(
            debug_steps,
            "provider_chat_completed",
            {
                "provider": response.provider,
                "model": response.model,
                "latency_ms": latency_ms,
                "prompt_tokens": response.prompt_tokens,
                "completion_tokens": response.completion_tokens,
                "finish_reason": response.finish_reason,
                "content_length": len(response.content or ""),
            },
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
        decision = AIResponseParser.parse(response.model_dump())
        greeting_fallback_applied = (
            AIOrchestratorService._is_greeting(message)
            and not (decision.reply_required and decision.reply)
        )
        decision = AIOrchestratorService._apply_greeting_fallback(decision, message)
        if greeting_fallback_applied:
            AIOrchestratorService._debug_step(
                debug_steps,
                "greeting_fallback_applied",
                {"reply": decision.reply, "confidence": decision.confidence},
                hotel_id=hotel_id,
                conversation_id=conversation_id,
            )
        AIOrchestratorService._debug_step(
            debug_steps,
            "decision_parsed",
            decision.model_dump(),
            hotel_id=hotel_id,
            conversation_id=conversation_id,
        )
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
        commit: bool = True,
    ):
        try:
            config = AISettingsService(db).get(hotel_id)
            return AIAnalyticsService.log_request(
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
                commit=commit,
            )
        except Exception:
            db.rollback()
            return None

    @staticmethod
    def log_debug_event(
        db: Session,
        hotel_id: str,
        usage_log_id: str | None,
        event: str,
        details: dict | None = None,
        result: dict | None = None,
        status: str = "success",
        error: str | None = None,
    ) -> None:
        AIToolExecutor._log_execution(
            db,
            hotel_id,
            usage_log_id,
            AIOrchestratorService._debug_tool_name(event),
            details,
            result,
            status=status,
            error=error,
        )
        logger.info(
            "ai_debug event=%s hotel_id=%s usage_log_id=%s status=%s details=%s error=%s",
            event,
            hotel_id,
            usage_log_id,
            status,
            details or {},
            error,
        )

    @staticmethod
    def _persist_debug_steps(
        db: Session,
        hotel_id: str,
        usage_log_id: str | None,
        debug_steps: list[AIDebugStep],
    ) -> None:
        for step in debug_steps:
            AIOrchestratorService.log_debug_event(
                db,
                hotel_id,
                usage_log_id,
                step.step,
                details=step.details,
                result={"status": step.status},
                status=step.status,
                error=step.error,
            )

    @staticmethod
    def _debug_step(
        debug_steps: list[AIDebugStep] | None,
        step: str,
        details: dict | None = None,
        status: str = "success",
        error: str | None = None,
        hotel_id: str | None = None,
        conversation_id: str | None = None,
    ) -> None:
        item = AIDebugStep(step=step, status=status, details=details or {}, error=error)
        if debug_steps is not None:
            debug_steps.append(item)
        logger.info(
            "ai_debug step=%s hotel_id=%s conversation_id=%s status=%s details=%s error=%s",
            step,
            hotel_id,
            conversation_id,
            status,
            details or {},
            error,
        )

    @staticmethod
    def _debug_config(config: dict) -> dict:
        return {
            "provider": config.get("provider"),
            "model": config.get("model"),
            "status": config.get("status"),
            "is_active": config.get("is_active"),
            "enable_auto_reply": config.get("enable_auto_reply"),
            "enable_ticket_creation": config.get("enable_ticket_creation"),
            "high_confidence_threshold": config.get("high_confidence_threshold"),
            "low_confidence_threshold": config.get("low_confidence_threshold"),
            "max_context_messages": config.get("max_context_messages"),
            "language": config.get("language"),
        }

    @staticmethod
    def _debug_tool_name(event: str) -> str:
        return f"debug.{event}"[:50]

    @staticmethod
    def _apply_greeting_fallback(decision: AIDecision, message: str) -> AIDecision:
        if not AIOrchestratorService._is_greeting(message):
            return decision
        if decision.reply_required and decision.reply:
            return decision
        return decision.model_copy(
            update={
                "intent": "information_request",
                "confidence": max(decision.confidence, 0.96),
                "sentiment": decision.sentiment or "neutral",
                "ticket_required": False,
                "reply_required": True,
                "ticket": None,
                "reply": "Hello! How can I help you today?",
                "reason": "Greeting fallback generated a guest-facing reply.",
            }
        )

    @staticmethod
    def _is_greeting(message: str) -> bool:
        return message.strip().lower() in {"hi", "hello", "hey", "menu", "start", "good morning", "good evening"}

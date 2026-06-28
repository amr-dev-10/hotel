from datetime import timedelta

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.models.ai_models import AIUsageLog
from app.models.base import utcnow
from app.schemas.ai import AIAnalyticsSummary


class AIAnalyticsService:
    PRICING = {
        "openai": {"gpt-4o-mini": {"prompt": 0.15, "completion": 0.60}},
        "gemini": {"gemini-2.0-flash": {"prompt": 0.10, "completion": 0.40}},
        "anthropic": {"claude-3-5-sonnet-latest": {"prompt": 3.00, "completion": 15.00}},
        "local": {"local-keyword": {"prompt": 0.0, "completion": 0.0}},
    }

    @staticmethod
    def log_request(
        db: Session,
        hotel_id: str,
        conversation_id: str | None,
        provider: str,
        model: str,
        request_type: str,
        prompt_tokens: int,
        completion_tokens: int,
        latency_ms: int,
        intent: str | None = None,
        confidence: float | None = None,
        sentiment: str | None = None,
        ticket_created: bool = False,
        ticket_id: str | None = None,
        escalated: bool = False,
        reply_sent: bool = False,
        error: str | None = None,
        commit: bool = False,
    ) -> AIUsageLog:
        total_tokens = prompt_tokens + completion_tokens
        log = AIUsageLog(
            hotel_id=hotel_id,
            conversation_id=conversation_id,
            provider=provider,
            model=model,
            request_type=request_type,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_tokens=total_tokens,
            latency_ms=latency_ms,
            estimated_cost_usd=AIAnalyticsService.get_cost_estimate(
                provider,
                model,
                prompt_tokens,
                completion_tokens,
            ),
            intent_detected=intent,
            confidence=confidence,
            sentiment=sentiment,
            ticket_created=ticket_created,
            ticket_id=ticket_id,
            escalated=escalated,
            reply_sent=reply_sent,
            error=error,
        )
        db.add(log)
        db.flush()
        if commit:
            db.commit()
            db.refresh(log)
        return log

    @staticmethod
    def get_usage_summary(db: Session, hotel_id: str, days: int = 30) -> AIAnalyticsSummary:
        since = utcnow() - timedelta(days=days)
        rows = db.execute(
            select(
                func.count(AIUsageLog.id),
                func.coalesce(func.sum(AIUsageLog.total_tokens), 0),
                func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0),
                func.coalesce(func.avg(AIUsageLog.latency_ms), 0),
                func.coalesce(func.sum(case((AIUsageLog.escalated.is_(True), 1), else_=0)), 0),
                func.coalesce(func.sum(case((AIUsageLog.reply_sent.is_(True), 1), else_=0)), 0),
            )
            .where(
                AIUsageLog.hotel_id == hotel_id,
                AIUsageLog.created_at >= since,
            )
        ).one()
        total_requests = int(rows[0] or 0)
        intent_rows = db.execute(
            select(AIUsageLog.intent_detected, func.count(AIUsageLog.id))
            .where(
                AIUsageLog.hotel_id == hotel_id,
                AIUsageLog.created_at >= since,
                AIUsageLog.intent_detected.is_not(None),
            )
            .group_by(AIUsageLog.intent_detected)
        ).all()
        escalated = int(rows[4] or 0)
        reply_sent = int(rows[5] or 0)
        return AIAnalyticsSummary(
            total_requests=total_requests,
            total_tokens=int(rows[1] or 0),
            total_cost=float(rows[2] or 0.0),
            avg_latency_ms=float(rows[3] or 0.0),
            escalation_rate=(escalated / total_requests) if total_requests else 0.0,
            auto_reply_rate=(reply_sent / total_requests) if total_requests else 0.0,
            intent_distribution={str(intent): int(count) for intent, count in intent_rows if intent},
        )

    @staticmethod
    def list_logs(db: Session, hotel_id: str, limit: int = 50) -> list[AIUsageLog]:
        return db.execute(
            select(AIUsageLog)
            .where(AIUsageLog.hotel_id == hotel_id)
            .order_by(AIUsageLog.created_at.desc())
            .limit(limit)
        ).scalars().all()

    @staticmethod
    def get_cost_estimate(
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
    ) -> float:
        model_pricing = AIAnalyticsService.PRICING.get(provider, {}).get(model)
        if not model_pricing:
            return 0.0
        return (
            (prompt_tokens / 1_000_000) * model_pricing["prompt"]
            + (completion_tokens / 1_000_000) * model_pricing["completion"]
        )

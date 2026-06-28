from app.schemas.ai import AIAction, AIDecision


class AIDecisionEngine:
    @staticmethod
    def evaluate(
        decision: AIDecision,
        config: dict,
        has_open_ticket: bool = False,
    ) -> AIAction:
        high_threshold = float(config.get("high_confidence_threshold") or 0.95)
        low_threshold = float(config.get("low_confidence_threshold") or 0.8)
        enable_auto_reply = bool(config.get("enable_auto_reply"))
        enable_ticket_creation = bool(config.get("enable_ticket_creation", True))
        enable_sentiment_analysis = bool(config.get("enable_sentiment_analysis", True))

        action = AIAction()
        if decision.confidence >= high_threshold:
            if decision.reply_required and decision.reply:
                action.reply_action = "auto_send" if enable_auto_reply else "suggest"
            if decision.ticket_required and enable_ticket_creation and not has_open_ticket:
                action.ticket_action = "auto_create"
        elif decision.confidence >= low_threshold:
            if decision.reply_required and decision.reply:
                action.reply_action = "suggest"
            if decision.ticket_required and not has_open_ticket:
                action.ticket_action = "suggest"
        else:
            action.reply_action = "none"
            if enable_ticket_creation and not has_open_ticket:
                action.ticket_action = "escalation"
                action.escalation_action = "create_escalation_ticket"
                action.escalation_reason = decision.reason or "AI confidence too low"

        if (
            enable_sentiment_analysis
            and decision.sentiment == "negative"
            and decision.confidence < 0.9
            and not has_open_ticket
        ):
            action.escalation_action = "flag_negative_sentiment"
            if enable_ticket_creation:
                action.ticket_action = "auto_create"
                action.escalation_reason = action.escalation_reason or "Negative sentiment detected"

        return action

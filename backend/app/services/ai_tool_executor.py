from sqlalchemy.orm import Session

from app.models.ai_models import AIToolExecutionLog
from app.models.base import utcnow
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.schemas.ai import AIAction, AIContext, AIDecision, AIExecutionResult, AITicketSuggestion
from app.schemas.ticket import TicketCreate
from app.services.ticket_service import TicketService
from app.services.whatsapp_ops_service import ConversationWindowService


class AIToolExecutor:
    INTENT_DEPARTMENT = {
        "housekeeping": "housekeeping",
        "maintenance": "engineering",
        "food_order": "food_beverage",
        "complaint": "front_office",
        "emergency": "front_office",
        "information_request": "front_office",
        "guest_request": "front_office",
    }
    INTENT_CATEGORY = {
        "housekeeping": "housekeeping",
        "maintenance": "maintenance",
        "food_order": "room_service",
        "complaint": "guest_request",
        "emergency": "emergency",
        "information_request": "guest_request",
        "guest_request": "guest_request",
    }
    INTENT_PRIORITY = {
        "emergency": 1,
        "complaint": 1,
        "maintenance": 2,
        "housekeeping": 2,
        "food_order": 3,
    }

    @staticmethod
    def execute(
        db: Session,
        hotel_id: str,
        action: AIAction,
        decision: AIDecision,
        context: AIContext,
        usage_log_id: str | None,
        config: dict,
    ) -> AIExecutionResult:
        result = AIExecutionResult()
        if action.reply_action == "auto_send" and decision.reply:
            outbound = AIToolExecutor._record_guest_reply(db, hotel_id, context, decision.reply)
            result.reply_sent = True
            result.reply_text = decision.reply
            AIToolExecutor._log_execution(
                db,
                hotel_id,
                usage_log_id,
                "reply_guest",
                {"reply": decision.reply},
                {"message_id": outbound.id if outbound else None},
            )
        elif action.reply_action == "suggest" and decision.reply:
            result.suggested_reply = decision.reply
            AIToolExecutor._log_execution(
                db,
                hotel_id,
                usage_log_id,
                "suggest_reply",
                {"reply": decision.reply},
                {"suggested": True},
            )

        if action.ticket_action == "auto_create" and decision.ticket:
            ticket = AIToolExecutor._create_ticket(db, hotel_id, decision.intent, decision.ticket, context)
            result.ticket_created = True
            result.ticket_id = ticket.id
            AIToolExecutor._log_execution(
                db,
                hotel_id,
                usage_log_id,
                "create_ticket",
                decision.ticket.model_dump(),
                {"ticket_id": ticket.id},
            )
        elif action.ticket_action == "suggest" and decision.ticket:
            AIToolExecutor._log_execution(
                db,
                hotel_id,
                usage_log_id,
                "suggest_ticket",
                decision.ticket.model_dump(),
                {"suggested": True},
            )
        elif action.ticket_action == "escalation":
            ticket = AIToolExecutor._create_escalation_ticket(
                db,
                hotel_id,
                decision,
                context,
                config.get("escalation_department_key") or "front_office",
                action.escalation_reason,
            )
            result.escalated = True
            result.escalation_ticket_id = ticket.id
            AIToolExecutor._log_execution(
                db,
                hotel_id,
                usage_log_id,
                "create_escalation_ticket",
                {"reason": action.escalation_reason, "decision": decision.model_dump()},
                {"ticket_id": ticket.id},
            )
        return result

    @staticmethod
    def _create_ticket(
        db: Session,
        hotel_id: str,
        intent: str,
        suggestion: AITicketSuggestion,
        context: AIContext,
    ):
        department_key = suggestion.department_key or AIToolExecutor.INTENT_DEPARTMENT.get(intent, "front_office")
        task_category = suggestion.task_category or AIToolExecutor.INTENT_CATEGORY.get(intent, "guest_request")
        ticket_type = intent if intent in {"complaint", "emergency", "vip_request"} else "Ticket"
        return TicketService(db).create_ticket(
            hotel_id,
            TicketCreate(
                guest_id=(context.guest or {}).get("id"),
                reservation_id=(context.reservation or {}).get("id"),
                conversation_id=context.conversation_id,
                room_id=context.room_id,
                department_key=department_key,
                type=ticket_type,
                task_category=task_category,
                item_description=suggestion.description or suggestion.title,
                source="AI",
                priority=suggestion.priority or AIToolExecutor.INTENT_PRIORITY.get(intent, 2),
            ),
            actor_id=None,
            commit=False,
        )

    @staticmethod
    def _create_escalation_ticket(
        db: Session,
        hotel_id: str,
        decision: AIDecision,
        context: AIContext,
        department_key: str,
        reason: str | None,
    ):
        title = decision.ticket.title if decision.ticket else "AI escalation"
        description = (
            f"{title}\n\n"
            f"AI confidence: {decision.confidence:.0%}\n"
            f"Intent: {decision.intent}\n"
            f"Reason: {reason or decision.reason or 'Manual review required'}"
        )
        return TicketService(db).create_ticket(
            hotel_id,
            TicketCreate(
                guest_id=(context.guest or {}).get("id"),
                reservation_id=(context.reservation or {}).get("id"),
                conversation_id=context.conversation_id,
                room_id=context.room_id,
                department_key=department_key,
                type="ai_escalation",
                task_category="guest_request",
                item_description=description,
                source="AI_ESCALATION",
                priority=2,
            ),
            actor_id=None,
            commit=False,
        )

    @staticmethod
    def _record_guest_reply(
        db: Session,
        hotel_id: str,
        context: AIContext,
        reply: str,
    ) -> WhatsAppMessage | None:
        if not context.conversation_id:
            return None
        conversation = db.get(WhatsAppConversation, context.conversation_id)
        if not conversation:
            return None
        message = WhatsAppMessage(
            hotel_id=hotel_id,
            whatsapp_account_id=conversation.whatsapp_account_id,
            conversation_id=conversation.id,
            reservation_id=(context.reservation or {}).get("id"),
            ticket_id=None,
            direction="outbound",
            message_type="text",
            message_text=reply,
            status="sent",
            created_at=utcnow(),
        )
        db.add(message)
        db.flush()
        ConversationWindowService(db).track_message(
            hotel_id,
            conversation.phone,
            category="service",
            commit=False,
        )
        return message

    @staticmethod
    def _log_execution(
        db: Session,
        hotel_id: str,
        usage_log_id: str | None,
        tool_name: str,
        tool_input: dict | None,
        tool_output: dict | None,
        status: str = "success",
        error: str | None = None,
    ) -> None:
        db.add(
            AIToolExecutionLog(
                hotel_id=hotel_id,
                usage_log_id=usage_log_id,
                tool_name=tool_name,
                tool_input=tool_input,
                tool_output=tool_output,
                status=status,
                executed_by="system",
                error=error,
            )
        )

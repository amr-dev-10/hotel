from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.schemas.guest_portal import GuestChatMessageRead, GuestChatSendResponse
from app.services.ai_orchestrator import AIOrchestratorService
from app.services.guest_portal_service import GuestPortalContext
from app.services.whatsapp_ops_service import ConversationWindowService


class GuestPortalChatService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create_conversation(self, context: GuestPortalContext) -> WhatsAppConversation:
        guest = self._guest(context)
        conversation = self.db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.hotel_id == context.hotel_id,
                WhatsAppConversation.guest_id == context.guest_id,
            )
        ).scalar_one_or_none()
        if conversation:
            if conversation.status == "deleted":
                conversation.status = "open"
                conversation.resolved_at = None
            if not conversation.phone:
                conversation.phone = self._guest_phone(guest)
            return conversation

        conversation = WhatsAppConversation(
            hotel_id=context.hotel_id,
            whatsapp_account_id=None,
            guest_id=context.guest_id,
            phone=self._guest_phone(guest),
            status="open",
            started_at=utcnow(),
            last_message_at=utcnow(),
        )
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def list_messages(self, context: GuestPortalContext, limit: int = 100) -> list[WhatsAppMessage]:
        conversation = self.get_or_create_conversation(context)
        rows = self.db.execute(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.hotel_id == context.hotel_id,
                WhatsAppMessage.conversation_id == conversation.id,
                WhatsAppMessage.whatsapp_account_id.is_(None),
            )
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(limit)
        ).scalars().all()
        return list(reversed(rows))

    async def send_message(self, context: GuestPortalContext, text: str) -> GuestChatSendResponse:
        conversation = self.get_or_create_conversation(context)
        inbound = self._record_message(context, conversation, "inbound", text)
        self.db.commit()
        self.db.refresh(inbound)
        self.db.refresh(conversation)

        ai_result = await AIOrchestratorService.process_message(
            self.db,
            context.hotel_id,
            conversation.id,
            text,
            inbound.id,
            source="portal",
        )

        ai_reply = self._outbound_message(context.hotel_id, ai_result.outbound_message_id)
        if ai_reply:
            ai_reply.whatsapp_account_id = None
            self.db.commit()
            self.db.refresh(ai_reply)

        reply_text = (
            ai_result.reply_text
            or ai_result.suggested_reply
            or (ai_result.decision.reply if ai_result.decision else None)
        )
        if not reply_text and ai_result.error:
            reply_text = "I could not reach the assistant right now. Please try again in a moment."
        elif not reply_text and (ai_result.ticket_id or ai_result.escalation_ticket_id):
            reply_text = "Thanks. I have shared this with the hotel team, and someone will assist you shortly."
        if not ai_reply and reply_text:
            ai_reply = self._record_message(context, conversation, "outbound", reply_text)
            self.db.commit()
            self.db.refresh(ai_reply)

        return GuestChatSendResponse(
            conversation_id=conversation.id,
            inbound_message=self._message_read(inbound),
            ai_reply=self._message_read(ai_reply) if ai_reply else None,
            intent=ai_result.decision.intent if ai_result.decision else None,
            confidence=ai_result.decision.confidence if ai_result.decision else None,
            ticket_id=ai_result.ticket_id or ai_result.escalation_ticket_id,
            error=ai_result.error,
        )

    def message_read(self, message: WhatsAppMessage) -> GuestChatMessageRead:
        return self._message_read(message)

    def _record_message(
        self,
        context: GuestPortalContext,
        conversation: WhatsAppConversation,
        direction: str,
        text: str,
    ) -> WhatsAppMessage:
        now = utcnow()
        if direction == "inbound" and conversation.status == "resolved":
            conversation.status = "open"
            conversation.resolved_at = None
        conversation.last_message_at = now
        message = WhatsAppMessage(
            hotel_id=context.hotel_id,
            whatsapp_account_id=None,
            conversation_id=conversation.id,
            reservation_id=context.reservation_id,
            ticket_id=None,
            direction=direction,
            message_type="text",
            message_text=text,
            status="received" if direction == "inbound" else "sent",
            created_at=now,
        )
        self.db.add(message)
        self.db.flush()
        ConversationWindowService(self.db).track_message(
            context.hotel_id,
            conversation.phone,
            category="service",
            commit=False,
        )
        return message

    def _outbound_message(self, hotel_id: str, message_id: str | None) -> WhatsAppMessage | None:
        if not message_id:
            return None
        return self.db.execute(
            select(WhatsAppMessage).where(
                WhatsAppMessage.hotel_id == hotel_id,
                WhatsAppMessage.id == message_id,
                WhatsAppMessage.direction == "outbound",
            )
        ).scalar_one_or_none()

    def _guest(self, context: GuestPortalContext) -> Guest:
        guest = self.db.get(Guest, context.guest_id)
        if not guest or guest.hotel_id != context.hotel_id:
            raise not_found("Guest not found")
        return guest

    def _guest_phone(self, guest: Guest) -> str:
        return guest.whatsapp_phone or guest.phone or f"guest:{guest.id}"

    def _message_read(self, message: WhatsAppMessage) -> GuestChatMessageRead:
        return GuestChatMessageRead(
            id=message.id,
            conversation_id=message.conversation_id,
            direction=message.direction,
            message_text=message.message_text,
            status=message.status,
            created_at=message.created_at,
        )

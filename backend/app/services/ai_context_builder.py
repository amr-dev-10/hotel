from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.ai_models import AIConversationSummary
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.reservation import Reservation
from app.models.room import Room
from app.models.ticket import Ticket
from app.models.whatsapp import WhatsAppConversation, WhatsAppMessage
from app.schemas.ai import AIContext


class AIContextBuilder:
    TERMINAL_TICKET_STAGES = ("Completed", "Cancelled", "approved", "cancelled", "closed", "resolved")

    @staticmethod
    def build_context(
        db: Session,
        hotel_id: str,
        conversation_id: str,
        message_limit: int = 20,
    ) -> AIContext:
        hotel = db.get(Hotel, hotel_id)
        if not hotel:
            raise not_found("Hotel not found")
        conversation = db.execute(
            select(WhatsAppConversation).where(
                WhatsAppConversation.hotel_id == hotel_id,
                WhatsAppConversation.id == conversation_id,
            )
        ).scalar_one_or_none()
        if not conversation:
            raise not_found("WhatsApp conversation not found")

        guest = db.get(Guest, conversation.guest_id) if conversation.guest_id else None
        reservation = AIContextBuilder._latest_reservation(db, hotel_id, guest.id if guest else None)
        room = db.get(Room, reservation.room_id) if reservation and reservation.room_id else None
        messages = AIContextBuilder._messages(db, hotel_id, conversation_id, message_limit)
        open_tickets = AIContextBuilder._open_tickets(db, hotel_id, conversation_id)
        summary = db.execute(
            select(AIConversationSummary).where(
                AIConversationSummary.hotel_id == hotel_id,
                AIConversationSummary.conversation_id == conversation_id,
            )
        ).scalar_one_or_none()

        return AIContext(
            hotel={
                "id": hotel.id,
                "name": hotel.name,
                "timezone": hotel.timezone,
                "contact_phone": hotel.contact_phone,
            },
            guest=AIContextBuilder._guest_dict(guest),
            reservation=AIContextBuilder._reservation_dict(reservation),
            room=AIContextBuilder._room_dict(room),
            conversation={
                "id": conversation.id,
                "phone": conversation.phone,
                "status": conversation.status,
                "priority": conversation.priority,
                "whatsapp_account_id": conversation.whatsapp_account_id,
            },
            messages=messages,
            open_tickets=open_tickets,
            conversation_summary=summary.summary if summary else None,
            conversation_id=conversation_id,
            room_id=room.id if room else None,
        )

    @staticmethod
    def _latest_reservation(db: Session, hotel_id: str, guest_id: str | None) -> Reservation | None:
        if not guest_id:
            return None
        return db.execute(
            select(Reservation)
            .where(
                Reservation.hotel_id == hotel_id,
                Reservation.guest_id == guest_id,
                Reservation.deleted_at.is_(None),
            )
            .order_by(Reservation.updated_at.desc())
        ).scalars().first()

    @staticmethod
    def _messages(
        db: Session,
        hotel_id: str,
        conversation_id: str,
        message_limit: int,
    ) -> list[dict]:
        rows = db.execute(
            select(WhatsAppMessage)
            .where(
                WhatsAppMessage.hotel_id == hotel_id,
                WhatsAppMessage.conversation_id == conversation_id,
            )
            .order_by(WhatsAppMessage.created_at.desc())
            .limit(message_limit)
        ).scalars().all()
        return [
            {
                "id": message.id,
                "direction": message.direction,
                "message_type": message.message_type,
                "text": message.message_text,
                "status": message.status,
                "created_at": message.created_at.isoformat() if message.created_at else None,
            }
            for message in reversed(rows)
        ]

    @staticmethod
    def _open_tickets(db: Session, hotel_id: str, conversation_id: str) -> list[dict]:
        rows = db.execute(
            select(Ticket)
            .where(
                Ticket.hotel_id == hotel_id,
                Ticket.conversation_id == conversation_id,
                Ticket.stage.not_in(AIContextBuilder.TERMINAL_TICKET_STAGES),
                Ticket.deleted_at.is_(None),
            )
            .order_by(Ticket.created_at.desc())
            .limit(10)
        ).scalars().all()
        return [
            {
                "id": ticket.id,
                "ticket_code": ticket.ticket_code,
                "stage": ticket.stage,
                "type": ticket.type,
                "task_category": ticket.task_category,
                "item_description": ticket.item_description,
                "priority": ticket.priority,
                "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
            }
            for ticket in rows
        ]

    @staticmethod
    def _guest_dict(guest: Guest | None) -> dict | None:
        if not guest:
            return None
        return {
            "id": guest.id,
            "name": guest.name,
            "phone": guest.phone,
            "whatsapp_phone": guest.whatsapp_phone,
            "status": guest.status,
            "check_in_date": guest.check_in_date.isoformat() if guest.check_in_date else None,
            "check_out_date": guest.check_out_date.isoformat() if guest.check_out_date else None,
        }

    @staticmethod
    def _reservation_dict(reservation: Reservation | None) -> dict | None:
        if not reservation:
            return None
        return {
            "id": reservation.id,
            "reservation_no": reservation.reservation_no,
            "status": reservation.status,
            "checkin_date": reservation.checkin_date.isoformat(),
            "checkout_date": reservation.checkout_date.isoformat(),
            "room_id": reservation.room_id,
        }

    @staticmethod
    def _room_dict(room: Room | None) -> dict | None:
        if not room:
            return None
        return {
            "id": room.id,
            "room_number": room.room_number,
            "room_type": room.room_type,
            "floor": room.floor,
            "status": room.status,
        }

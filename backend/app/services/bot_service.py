from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.models.guest import Guest
from app.models.base import utcnow
from app.models.reservation import StayRecord
from app.models.whatsapp import WhatsAppMessage
from app.models.whatsapp_session import WhatsAppSession
from app.repositories.bot_config_repository import BotConfigRepository
from app.repositories.guest_repository import GuestRepository
from app.repositories.hotel_repository import HotelRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.whatsapp_repository import (
    WhatsAppAccountRepository,
    WhatsAppConversationRepository,
)
from app.repositories.whatsapp_session_repository import WhatsAppSessionRepository
from app.schemas.reservation import ReservationCreate
from app.schemas.ticket import TicketCreate
from app.services.defaults import DEFAULT_BOT_MESSAGES, DEFAULT_MAIN_MENU, DEFAULT_SERVICES
from app.services.knowledge_service import FAQService
from app.services.gemini_service import GeminiService
from app.services.reservation_service import ReservationService
from app.services.ticket_service import TicketService


@dataclass
class IncomingWhatsAppMessage:
    phone_number_id: str | None
    from_phone: str
    text: str | None = None
    interactive_id: str | None = None


class BotService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.hotels = HotelRepository(db)
        self.sessions = WhatsAppSessionRepository(db)
        self.guests = GuestRepository(db)
        self.rooms = RoomRepository(db)
        self.bot_configs = BotConfigRepository(db)
        self.ticket_repo = TicketRepository(db)
        self.whatsapp_accounts = WhatsAppAccountRepository(db)
        self.conversations = WhatsAppConversationRepository(db)
        self.gemini = GeminiService()
        self.faqs = FAQService(db)
        self.ticket_service = TicketService(db)
        self.reservations = ReservationService(db)

    def handle_message(self, message: IncomingWhatsAppMessage) -> dict[str, Any]:
        hotel = self._resolve_hotel(message.phone_number_id)
        if not hotel:
            raise bad_request("No hotel is mapped to this WhatsApp phone_number_id")

        session = self.sessions.get_or_create(
            hotel.id,
            message.from_phone,
            message.phone_number_id,
        )
        self._record_message(
            hotel.id,
            session,
            direction="inbound",
            message_type="interactive" if message.interactive_id else "text",
            text=message.text or message.interactive_id,
        )
        config = self.bot_configs.get_for_hotel(hotel.id)
        services = config.services if config and config.services else DEFAULT_SERVICES
        messages = config.messages if config and config.messages else DEFAULT_BOT_MESSAGES

        replies: list[dict[str, Any]] = []
        ticket_id: str | None = None

        if message.interactive_id:
            ticket_id = self._handle_interactive(
                hotel.id,
                session,
                message.interactive_id,
                services,
                replies,
            )
        elif session.state in {"new", "idle"}:
            self._start_onboarding(hotel.id, hotel.name, session, messages, replies)
        elif session.state == "awaiting_name":
            self._capture_name(session, message.text or "", messages, replies)
        elif session.state == "awaiting_room":
            self._capture_room(hotel.id, session, message.text or "", messages, replies)
        elif session.state == "awaiting_free_text":
            ticket_id = self._create_free_text_ticket(hotel.id, session, message.text or "", replies)
        else:
            ticket_id = self._handle_active_text(
                hotel.id,
                session,
                message.text or "",
                services,
                replies,
            )

        self.db.commit()
        for reply in replies:
            self._record_message(
                hotel.id,
                session,
                direction="outbound",
                message_type=reply["kind"],
                text=reply.get("text"),
            )
        self.db.commit()
        return {
            "hotel_id": hotel.id,
            "phone": message.from_phone,
            "session_state": session.state,
            "replies": replies,
            "ticket_id": ticket_id,
        }

    def parse_webhook_payload(self, payload: dict[str, Any]) -> list[IncomingWhatsAppMessage]:
        messages: list[IncomingWhatsAppMessage] = []
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                phone_number_id = value.get("metadata", {}).get("phone_number_id")
                for item in value.get("messages", []):
                    text = item.get("text", {}).get("body")
                    interactive = item.get("interactive", {})
                    interactive_id = None
                    if "list_reply" in interactive:
                        interactive_id = interactive["list_reply"].get("id")
                    elif "button_reply" in interactive:
                        interactive_id = interactive["button_reply"].get("id")
                    if item.get("from"):
                        messages.append(
                            IncomingWhatsAppMessage(
                                phone_number_id=phone_number_id,
                                from_phone=item["from"],
                                text=text,
                                interactive_id=interactive_id,
                            )
                        )
        return messages

    def _resolve_hotel(self, phone_number_id: str | None):
        if phone_number_id:
            account = self.whatsapp_accounts.get_by_phone_number_id(phone_number_id)
            if account:
                return self.hotels.get(account.hotel_id)
            hotel = self.hotels.get_by_phone_number_id(phone_number_id)
            if hotel:
                return hotel
        return self.hotels.first_active()

    def _start_onboarding(
        self,
        hotel_id: str,
        hotel_name: str,
        session: WhatsAppSession,
        messages: dict[str, str],
        replies: list[dict[str, Any]],
    ) -> None:
        guest = self.guests.find_active_by_phone(hotel_id, session.phone)
        if guest:
            session.guest_id = guest.id
            session.room_id = guest.room_id
            session.state = "active"
            replies.append(self._text(messages.get("active_welcome", "Welcome, {guest_name}.").format(guest_name=guest.name)))
            replies.append(self._main_menu(guest.name))
            return

        session.state = "awaiting_name"
        session.pending_action = {}
        replies.append(
            self._text(
                messages.get("welcome_new", "Welcome to {hotel_name}. Please share your name.").format(
                    hotel_name=hotel_name
                )
            )
        )

    def _capture_name(
        self,
        session: WhatsAppSession,
        name: str,
        messages: dict[str, str],
        replies: list[dict[str, Any]],
    ) -> None:
        clean_name = name.strip()
        if len(clean_name) < 2:
            replies.append(self._text("Please share your full name."))
            return
        session.pending_action = {"guest_name": clean_name}
        session.state = "awaiting_room"
        replies.append(
            self._text(
                messages.get("ask_room", "Thanks, {guest_name}. What is your room number?").format(
                    guest_name=clean_name
                )
            )
        )

    def _capture_room(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        room_number: str,
        messages: dict[str, str],
        replies: list[dict[str, Any]],
    ) -> None:
        clean_room = room_number.strip()
        room = self.rooms.get_by_number(hotel_id, clean_room)
        if not room:
            replies.append(
                self._text(
                    messages.get("room_not_found", "I could not find room {room_number}.").format(
                        room_number=clean_room
                    )
                )
            )
            return

        guest_name = (session.pending_action or {}).get("guest_name", "Guest")
        reservation = self.reservations.create_reservation(
            hotel_id,
            ReservationCreate(
                guest_name=guest_name,
                phone=session.phone,
                whatsapp_phone=session.phone,
                room_id=room.id,
                checkin_date=date.today(),
                checkout_date=date.today() + timedelta(days=1),
                source="walk_in",
            ),
            actor_id=None,
            commit=False,
        )
        guest = self.guests.get_for_hotel(hotel_id, reservation.guest_id)
        if guest:
            reservation.status = "checked_in"
            guest.status = "checked_in"
            room.status = "occupied"
        self.db.add(
            StayRecord(
                hotel_id=hotel_id,
                reservation_id=reservation.id,
                room_id=room.id,
                actual_checkin=utcnow(),
            )
        )

        session.guest_id = reservation.guest_id
        session.room_id = room.id
        session.state = "active"
        session.pending_action = None
        replies.append(self._text(f"Welcome, {guest_name}. You are all set."))
        replies.append(self._main_menu(guest_name))

    def _handle_interactive(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        interactive_id: str,
        services: list[dict[str, Any]],
        replies: list[dict[str, Any]],
    ) -> str | None:
        if interactive_id == "main_room_service":
            replies.append(self._room_service_list(services))
            return None
        if interactive_id == "main_food":
            replies.append(self._text("Food ordering is ready. Please type what you would like, or ask for the menu."))
            return None
        if interactive_id == "main_manager":
            return self._create_service_ticket(
                hotel_id,
                session,
                {
                    "department_key": "front_office",
                    "item": "Talk to Manager",
                    "priority": 2,
                },
                replies,
            )
        if interactive_id == "my_requests":
            self._send_my_requests(hotel_id, session, replies)
            return None
        if interactive_id == "query_complaint":
            session.state = "awaiting_free_text"
            replies.append(self._text("Please describe your query or complaint."))
            return None
        if interactive_id == "confirm_ticket_yes":
            pending = session.pending_action or {}
            session.pending_action = None
            session.state = "active"
            return self._create_service_ticket(hotel_id, session, pending, replies)
        if interactive_id == "confirm_ticket_no":
            session.pending_action = None
            session.state = "active"
            replies.append(self._main_menu(self._guest_name(hotel_id, session)))
            return None

        service = self._service_by_id(services, interactive_id)
        if service:
            return self._create_service_ticket(hotel_id, session, service, replies)

        replies.append(self._main_menu(self._guest_name(hotel_id, session)))
        return None

    def _handle_active_text(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        text: str,
        services: list[dict[str, Any]],
        replies: list[dict[str, Any]],
    ) -> str | None:
        if self._is_greeting(text):
            replies.append(self._main_menu(self._guest_name(hotel_id, session)))
            return None

        faq_answer = self.faqs.answer(hotel_id, text)
        if faq_answer:
            replies.append(self._text(faq_answer))
            return None

        match = self.gemini.classify_free_text(
            text,
            services=services,
            guest_name=self._guest_name(hotel_id, session),
        )
        if match.get("matched"):
            session.pending_action = {
                "department_key": match.get("department_key"),
                "item": match.get("item"),
                "priority": match.get("priority", 2),
            }
            replies.append(
                {
                    "kind": "buttons",
                    "text": f"Should I raise a request for: {match.get('item')}?",
                    "payload": {
                        "buttons": [
                            {"id": "confirm_ticket_yes", "title": "Yes, please"},
                            {"id": "confirm_ticket_no", "title": "No, menu"},
                        ]
                    },
                }
            )
            return None

        replies.append(self._main_menu(self._guest_name(hotel_id, session)))
        return None

    def _create_free_text_ticket(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        text: str,
        replies: list[dict[str, Any]],
    ) -> str:
        session.state = "active"
        return self._create_service_ticket(
            hotel_id,
            session,
            {
                "department_key": "front_office",
                "item": text.strip() or "Guest query",
                "priority": 2,
            },
            replies,
        )

    def _create_service_ticket(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        service: dict[str, Any],
        replies: list[dict[str, Any]],
    ) -> str:
        ticket = self.ticket_service.create_ticket(
            hotel_id,
            TicketCreate(
                guest_id=session.guest_id,
                room_id=session.room_id,
                department_key=service.get("department_key"),
                item_description=service.get("item") or service.get("title") or "Guest request",
                source="whatsapp",
                type="Ticket",
                priority=int(service.get("priority") or 2),
            ),
            commit=True,
        )
        replies.append(
            self._text(
                "Your request has been raised.\n"
                f"Request ID: {ticket.ticket_code}\n"
                f"Item: {ticket.item_description}\n"
                "I will notify you when it is done."
            )
        )
        return ticket.id

    def _send_my_requests(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        replies: list[dict[str, Any]],
    ) -> None:
        if not session.guest_id:
            replies.append(self._text("I could not find active requests yet."))
            return
        tickets = self.ticket_repo.list_open_for_guest(hotel_id, session.guest_id)
        if not tickets:
            replies.append(self._text("You do not have any open requests right now."))
            return
        lines = ["Your open requests:"]
        for ticket in tickets[:5]:
            lines.append(f"- {ticket.ticket_code}: {ticket.item_description} ({ticket.stage})")
        replies.append(self._text("\n".join(lines)))

    def _service_by_id(
        self,
        services: list[dict[str, Any]],
        service_id: str,
    ) -> dict[str, Any] | None:
        for service in services:
            if service.get("id") == service_id:
                return service
        return None

    def _guest_name(self, hotel_id: str, session: WhatsAppSession) -> str:
        if session.guest_id:
            guest = self.guests.get_for_hotel(hotel_id, session.guest_id)
            if guest:
                return guest.name
        return "Guest"

    def _is_greeting(self, text: str) -> bool:
        return text.strip().lower() in {"hi", "hello", "hey", "menu", "start"}

    def _text(self, text: str) -> dict[str, Any]:
        return {"kind": "text", "text": text}

    def _main_menu(self, guest_name: str) -> dict[str, Any]:
        return {
            "kind": "interactive_list",
            "text": f"Hi {guest_name}. How can I help?",
            "payload": {
                "button_text": "Open Menu",
                "rows": [
                    {"id": item["id"], "title": item["title"]}
                    for item in DEFAULT_MAIN_MENU
                ],
            },
        }

    def _room_service_list(self, services: list[dict[str, Any]]) -> dict[str, Any]:
        rows = [
            {"id": item["id"], "title": item.get("title") or item.get("item") or item["id"]}
            for item in services
        ]
        return {
            "kind": "interactive_list",
            "text": "Room Services",
            "payload": {"button_text": "Choose", "rows": rows},
        }

    def _record_message(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        direction: str,
        message_type: str,
        text: str | None,
    ) -> None:
        conversation = self.conversations.get_or_create(hotel_id, session.phone, session.guest_id)
        self.db.add(
            WhatsAppMessage(
                hotel_id=hotel_id,
                conversation_id=conversation.id,
                direction=direction,
                message_type=message_type,
                message_text=text,
                status="sent",
                created_at=utcnow(),
            )
        )

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.models.guest import Guest
from app.models.base import utcnow
from app.models.reservation import Reservation, StayRecord
from app.models.whatsapp import WhatsAppMessage
from app.models.whatsapp_session import WhatsAppSession
from app.repositories.bot_config_repository import BotConfigRepository
from app.repositories.guest_repository import GuestRepository
from app.repositories.hotel_repository import HotelRepository
from app.repositories.room_repository import RoomRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.knowledge_repository import ServiceFormRepository
from app.repositories.reservation_repository import ReservationRepository, StayRecordRepository
from app.repositories.whatsapp_repository import (
    WhatsAppAccountRepository,
    WhatsAppConversationRepository,
)
from app.repositories.whatsapp_session_repository import WhatsAppSessionRepository
from app.schemas.consent import GuestConsentUpsert
from app.schemas.reservation import ReservationCreate
from app.schemas.ticket import TicketCreate
from app.services.consent_service import GuestConsentService
from app.services.defaults import DEFAULT_BOT_MESSAGES, DEFAULT_MAIN_MENU, DEFAULT_SERVICES
from app.services.knowledge_service import FAQService, KnowledgeDocumentService
from app.services.whatsapp_ops_service import ConversationWindowService, LiveChatService
from app.services.gemini_service import GeminiService
from app.services.folio_service import FolioService
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
        self.service_forms = ServiceFormRepository(db)
        self.reservation_repo = ReservationRepository(db)
        self.stay_records = StayRecordRepository(db)
        self.whatsapp_accounts = WhatsAppAccountRepository(db)
        self.conversations = WhatsAppConversationRepository(db)
        self.gemini = GeminiService()
        self.faqs = FAQService(db)
        self.knowledge_documents = KnowledgeDocumentService(db)
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
        elif session.state == "live_chat":
            self._handle_live_chat_text(hotel.id, session, message.text or "", replies)
        elif session.state == "awaiting_form_field":
            ticket_id = self._handle_form_field(hotel.id, session, message.text or "", replies)
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
                ticket_id=ticket_id,
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
        guest = self.guests.find_by_phone(hotel_id, session.phone)
        if guest:
            session.guest_id = guest.id
            room_id = self._current_room_id_for_guest(hotel_id, guest.id)
            if room_id:
                session.room_id = room_id
                session.state = "active"
                replies.append(self._text(messages.get("active_welcome", "Welcome back, {guest_name}.").format(guest_name=guest.name)))
                replies.append(self._main_menu(guest.name))
            else:
                session.state = "live_chat"
                replies.append(self._text(f"Hello {guest.name}, welcome to {hotel_name}. A staff member will be with you shortly."))
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
            GuestConsentService(self.db).upsert(
                hotel_id,
                guest.id,
                GuestConsentUpsert(
                    whatsapp_opt_in=True,
                    marketing_opt_in=True,
                    consent_source="whatsapp_bot",
                ),
                commit=False,
            )
        self.db.add(
            StayRecord(
                hotel_id=hotel_id,
                reservation_id=reservation.id,
                room_id=room.id,
                actual_checkin=utcnow(),
            )
        )
        FolioService(self.db).ensure_for_reservation(hotel_id, reservation.id, actor_id=None, commit=False)

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
            chat = LiveChatService(self.db).start(
                hotel_id,
                session.phone,
                session.guest_id,
                commit=False,
            )
            session.state = "live_chat"
            session.pending_action = {"live_chat_session_id": chat.id}
            replies.append(self._text("I have notified our team. Please type your message here and staff will reply shortly."))
            return chat.id
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
            form = self.service_forms.find_for_service(
                hotel_id,
                service.get("id"),
                service.get("item") or service.get("title"),
            )
            if form:
                fields = [
                    {
                        "field_name": field.field_name,
                        "label": field.label or field.field_name,
                        "field_type": field.field_type,
                        "required": field.required,
                    }
                    for field in self.service_forms.fields_for_form(form.id)
                ]
                if fields:
                    session.state = "awaiting_form_field"
                    session.form_responses = {}
                    session.pending_action = {
                        "service": service,
                        "form_id": form.id,
                        "fields": fields,
                        "field_index": 0,
                    }
                    replies.append(self._text(self._field_prompt(fields[0])))
                    return None
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

        rag_answer = self.knowledge_documents.answer(hotel_id, text)
        if rag_answer:
            replies.append(self._text(rag_answer))
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

    def _handle_live_chat_text(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        text: str,
        replies: list[dict[str, Any]],
    ) -> None:
        chat = LiveChatService(self.db).start(hotel_id, session.phone, session.guest_id, commit=False)
        session.pending_action = {"live_chat_session_id": chat.id}
        replies.append(self._text("Your message has been passed to staff. They will reply here shortly."))

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
                "category_key": "guest_request",
                "item": text.strip() or "Guest query",
                "priority": 2,
            },
            replies,
        )

    def _handle_form_field(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        text: str,
        replies: list[dict[str, Any]],
    ) -> str | None:
        pending = session.pending_action or {}
        fields = pending.get("fields") or []
        field_index = int(pending.get("field_index") or 0)
        if field_index >= len(fields):
            session.state = "active"
            return self._create_service_ticket(
                hotel_id,
                session,
                pending.get("service") or {},
                replies,
            )

        current_field = fields[field_index]
        clean_value = text.strip()
        if current_field.get("required") and not clean_value:
            replies.append(self._text(f"{current_field.get('label')} is required."))
            return None

        responses = dict(session.form_responses or {})
        responses[current_field["field_name"]] = clean_value
        session.form_responses = responses
        field_index += 1
        updated_pending = dict(pending)
        updated_pending["field_index"] = field_index
        session.pending_action = updated_pending

        if field_index < len(fields):
            replies.append(self._text(self._field_prompt(fields[field_index])))
            return None

        service = pending.get("service") or {}
        session.state = "active"
        session.pending_action = None
        return self._create_service_ticket(hotel_id, session, service, replies)

    def _create_service_ticket(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        service: dict[str, Any],
        replies: list[dict[str, Any]],
    ) -> str:
        form_responses = session.form_responses or {}
        description = service.get("item") or service.get("title") or "Guest request"
        if form_responses:
            details = ", ".join(f"{key}: {value}" for key, value in form_responses.items())
            description = f"{description} ({details})"
        conversation = self.conversations.get_or_create(hotel_id, session.phone, session.guest_id)
        ticket = self.ticket_service.create_ticket(
            hotel_id,
            TicketCreate(
                guest_id=session.guest_id,
                reservation_id=self._active_reservation_id(hotel_id, session.guest_id),
                conversation_id=conversation.id,
                room_id=session.room_id,
                department_key=service.get("department_key"),
                task_category=service.get("category_key") or service.get("task_category") or self._category_key_for_service(service),
                item_description=description,
                source="WHATSAPP",
                type="Ticket",
                priority=int(service.get("priority") or 2),
            ),
            commit=True,
        )
        session.form_responses = {}
        replies.append(
            self._text(
                "Your request has been raised.\n"
                f"Request ID: {ticket.ticket_code}\n"
                f"Item: {ticket.item_description}\n"
                "I will notify you when it is done."
            )
        )
        return ticket.id

    def _category_key_for_service(self, service: dict[str, Any]) -> str | None:
        service_id = service.get("id")
        if service_id:
            mapped = {
                "extra_towels": "towel_request",
                "drinking_water": "drinking_water",
                "extra_pillows": "extra_pillow",
                "ac_not_working": "ac_repair",
                "tv_not_working": "tv_repair",
                "plumbing_issue": "plumbing",
                "taxi_cab": "taxi_booking",
            }.get(service_id)
            if mapped:
                return mapped
        department_key = service.get("department_key")
        if department_key == "front_office":
            return "guest_request"
        if department_key == "housekeeping":
            return "housekeeping"
        if department_key == "engineering":
            return "maintenance"
        if department_key == "food_beverage":
            return "room_service"
        return None

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

    def _current_room_id_for_guest(self, hotel_id: str, guest_id: str) -> str | None:
        reservation = self.db.execute(
            select(Reservation)
            .where(
                Reservation.hotel_id == hotel_id,
                Reservation.guest_id == guest_id,
                Reservation.status == "checked_in",
            )
            .order_by(Reservation.updated_at.desc())
        ).scalars().first()
        if not reservation:
            return None
        stay = self.stay_records.get_active_for_reservation(hotel_id, reservation.id)
        return stay.room_id if stay else reservation.room_id

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

    def _field_prompt(self, field: dict[str, Any]) -> str:
        return f"{field.get('label') or field.get('field_name')}?"

    def _record_message(
        self,
        hotel_id: str,
        session: WhatsAppSession,
        direction: str,
        message_type: str,
        text: str | None = None,
        interactive_id: str | None = None,
        ticket_id: str | None = None,
    ) -> None:
        conversation = self.conversations.get_or_create(hotel_id, session.phone, session.guest_id)
        if direction == "inbound" and conversation.status == "resolved":
            conversation.status = "open"
            conversation.resolved_at = None
        
        message = WhatsAppMessage(
            hotel_id=hotel_id,
            conversation_id=conversation.id,
            reservation_id=self._active_reservation_id(hotel_id, session.guest_id),
            ticket_id=ticket_id,
            direction=direction,
            message_type=message_type,
            message_text=text,
            status="received" if direction == "inbound" else "sent",
            created_at=utcnow(),
        )
        self.db.add(message)
        ConversationWindowService(self.db).track_message(
            hotel_id,
            session.phone,
            category="service",
            commit=False,
        )

    def _active_reservation_id(self, hotel_id: str, guest_id: str | None) -> str | None:
        if not guest_id:
            return None
        reservation = self.reservations.db.execute(
            select(Reservation)
            .where(
                Reservation.hotel_id == hotel_id,
                Reservation.guest_id == guest_id,
                Reservation.status.in_(["checked_in", "pre_arrival", "confirmed"]),
            )
            .order_by(Reservation.checkin_date.desc())
        ).scalars().first()
        return reservation.id if reservation else None

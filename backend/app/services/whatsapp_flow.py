from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import re
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.bot_config.models import BotConfig
from app.modules.department.models import Department
from app.modules.guest.models import Guest
from app.modules.room.models import Room
from app.modules.ticket.models import Ticket, TicketAssignment, TicketHistory, TicketPriority, TicketStatus
from app.modules.user.models import User
from app.modules.whatsapp_session.models import WhatsAppSession


@dataclass(frozen=True)
class ServiceIntent:
    service_id: str
    item: str
    department_key: str
    aliases: tuple[str, ...]
    priority: TicketPriority = TicketPriority.medium
    sla_minutes: int = 30


@dataclass(frozen=True)
class WhatsAppFlowResult:
    session_id: str
    state: str
    reply_text: str
    ticket_id: str | None = None
    ticket_event_payload: dict[str, Any] | None = None


BUILT_IN_SERVICES: tuple[ServiceIntent, ...] = (
    ServiceIntent("extra_towels", "Extra Towels", "housekeeping", ("extra towels", "towels", "towel"), sla_minutes=15),
    ServiceIntent("drinking_water", "Drinking Water", "housekeeping", ("drinking water", "water", "bottle"), sla_minutes=10),
    ServiceIntent("extra_pillows", "Extra Pillows", "housekeeping", ("extra pillows", "pillow", "pillows"), sla_minutes=15),
    ServiceIntent("ac_not_working", "AC Not Working", "engineering", ("ac", "a c", "air conditioning", "cooling"), TicketPriority.high, 20),
    ServiceIntent("tv_not_working", "TV Not Working", "engineering", ("tv", "television"), sla_minutes=25),
    ServiceIntent("plumbing_issue", "Plumbing Issue", "engineering", ("plumbing", "tap", "leak", "bathroom", "toilet"), TicketPriority.high, 20),
    ServiceIntent("taxi_cab", "Taxi/Cab", "front-desk", ("taxi", "cab", "car"), sla_minutes=20),
    ServiceIntent("luggage_help", "Luggage Help", "front-desk", ("luggage", "bags", "bellman"), sla_minutes=15),
)

ROOM_SERVICE_MENU = "\n".join(
    [
        "Room Services",
        "",
        "Room Amenities:",
        "1. Extra Towels",
        "2. Drinking Water",
        "3. Extra Pillows",
        "",
        "Room Issues:",
        "4. AC Not Working",
        "5. TV Not Working",
        "6. Plumbing Issue",
        "",
        "Other Services:",
        "7. Taxi/Cab",
        "8. Other",
    ]
)


class WhatsAppFlowService:
    session_ttl = timedelta(hours=24)

    def process_text(
        self,
        *,
        db: Session,
        hotel_id: str,
        hotel_name: str,
        phone: str,
        whatsapp_phone_number_id: str | None,
        text: str,
        action_id: str | None = None,
    ) -> WhatsAppFlowResult:
        now = datetime.now(timezone.utc)
        session = self._get_or_create_session(db, hotel_id, phone, whatsapp_phone_number_id)
        session.last_active_at = now
        session.expires_at = now + self.session_ttl
        session.whatsapp_phone_number_id = whatsapp_phone_number_id

        bot_config = db.scalar(select(BotConfig).where(BotConfig.tenant_id == hotel_id))
        clean_text = text.strip()
        normalized = _normalize(action_id or clean_text)

        if session.state == "new":
            return self._start_onboarding(db, hotel_id, hotel_name, session, clean_text, bot_config)

        if session.state == "awaiting_name":
            session.pending_action = {"guest_name": clean_text}
            session.state = "awaiting_room_number"
            db.flush()
            return self._result(session, f"Thanks, {clean_text}. What is your room number?")

        if session.state == "awaiting_room_number":
            return self._complete_self_registration(db, hotel_id, hotel_name, session, clean_text, bot_config)

        if session.state == "awaiting_ticket_confirmation":
            pending_service = (session.pending_action or {}).get("service")
            if normalized in {"yes", "y", "ok", "okay", "confirm", "please", "yesplease"} and pending_service:
                intent = self._intent_from_payload(pending_service)
                return self._create_ticket_result(db, hotel_id, session, intent, bot_config)
            if normalized in {"no", "n", "menu", "cancel"}:
                session.state = "active"
                session.pending_action = None
                db.flush()
                return self._result(session, self._main_menu_text(hotel_name, session, bot_config))
            return self._result(session, "Please reply yes to raise the request, or no to return to the menu.")

        if session.state == "awaiting_room_service_item":
            intent = self._match_service(bot_config, clean_text, action_id)
            if intent is not None:
                return self._create_ticket_result(db, hotel_id, session, intent, bot_config)
            if normalized in {"8", "other", "others"}:
                session.state = "awaiting_free_text"
                db.flush()
                return self._result(session, "Please type what you need and I will raise it for the hotel team.")
            return self._result(session, "Please choose one room service option, or type 8 for other.")

        if session.state == "awaiting_free_text":
            intent = self._match_service(bot_config, clean_text, action_id)
            if intent is None:
                intent = ServiceIntent("guest_request", clean_text[:120], "front-desk", (clean_text,), TicketPriority.medium, 30)
            return self._create_ticket_result(db, hotel_id, session, intent, bot_config)

        if session.state == "talking_to_manager":
            intent = ServiceIntent("manager_message", f"Manager message: {clean_text}", "front-desk", (clean_text,), TicketPriority.high, 10)
            return self._create_ticket_result(db, hotel_id, session, intent, bot_config)

        return self._handle_active_guest(db, hotel_id, hotel_name, session, clean_text, action_id, bot_config)

    def _get_or_create_session(
        self,
        db: Session,
        hotel_id: str,
        phone: str,
        whatsapp_phone_number_id: str | None,
    ) -> WhatsAppSession:
        session = db.scalar(
            select(WhatsAppSession).where(
                WhatsAppSession.tenant_id == hotel_id,
                WhatsAppSession.phone == phone,
            )
        )
        if session is not None:
            return session

        session = WhatsAppSession(
            hotel_id=hotel_id,
            phone=phone,
            state="new",
            cart={},
            whatsapp_phone_number_id=whatsapp_phone_number_id,
        )
        db.add(session)
        db.flush()
        return session

    def _start_onboarding(
        self,
        db: Session,
        hotel_id: str,
        hotel_name: str,
        session: WhatsAppSession,
        text: str,
        bot_config: BotConfig | None,
    ) -> WhatsAppFlowResult:
        guest = self._find_active_guest(db, hotel_id, session.phone)
        if guest is not None:
            session.state = "active"
            session.guest_id = guest.id
            session.room_id = guest.room_id
            session.pending_action = None
            db.flush()
            return self._result(session, self._welcome_text(hotel_name, guest, bot_config))

        session.state = "awaiting_name"
        session.pending_action = {"started_with": text}
        db.flush()
        return self._result(session, f"Welcome to {hotel_name}. Please share your name to get started.")

    def _complete_self_registration(
        self,
        db: Session,
        hotel_id: str,
        hotel_name: str,
        session: WhatsAppSession,
        room_number: str,
        bot_config: BotConfig | None,
    ) -> WhatsAppFlowResult:
        room = db.scalar(
            select(Room).where(
                Room.tenant_id == hotel_id,
                func.lower(Room.room_number) == room_number.strip().lower(),
            )
        )
        if room is None:
            return self._result(session, "I could not find that room number. Please enter the room number again.")

        guest_name = (session.pending_action or {}).get("guest_name") or "Guest"
        guest = Guest(
            hotel_id=hotel_id,
            room_id=room.id,
            name=guest_name,
            phone=session.phone,
            whatsapp_phone=session.phone,
            check_in_date=datetime.now(timezone.utc).date().isoformat(),
            status="checked_in",
        )
        room.status = "occupied"
        db.add(guest)
        db.flush()

        session.state = "active"
        session.guest_id = guest.id
        session.room_id = room.id
        session.pending_action = None
        db.flush()
        return self._result(session, self._welcome_text(hotel_name, guest, bot_config))

    def _handle_active_guest(
        self,
        db: Session,
        hotel_id: str,
        hotel_name: str,
        session: WhatsAppSession,
        text: str,
        action_id: str | None,
        bot_config: BotConfig | None,
    ) -> WhatsAppFlowResult:
        normalized = _normalize(action_id or text)
        if normalized in {"hi", "hello", "hey", "start", "menu", "mainmenu"}:
            return self._result(session, self._main_menu_text(hotel_name, session, bot_config))

        if normalized in {"roomservices", "roomservice", "services", "2"}:
            session.state = "awaiting_room_service_item"
            session.pending_action = {"type": "room_services"}
            db.flush()
            return self._result(session, ROOM_SERVICE_MENU)

        if normalized in {"food", "foodbeverages", "foodmenu", "menufood", "1"}:
            return self._result(session, self._food_menu_text(bot_config))

        if normalized in {"talktomanager", "manager", "3"}:
            session.state = "talking_to_manager"
            session.pending_action = {"type": "manager_chat"}
            db.flush()
            return self._result(session, "Please type your message for the manager.")

        if normalized in {"myrequests", "requests", "4"}:
            return self._result(session, self._my_requests_text(db, hotel_id, session))

        intent = self._match_service(bot_config, text, action_id)
        if intent is not None and action_id:
            return self._create_ticket_result(db, hotel_id, session, intent, bot_config)
        if intent is not None:
            session.state = "awaiting_ticket_confirmation"
            session.pending_action = {"service": self._intent_to_payload(intent)}
            db.flush()
            return self._result(session, f"Should I raise a request for: {intent.item}? Reply yes or no.")

        session.state = "awaiting_free_text"
        db.flush()
        return self._result(session, "Please describe your query or complaint and I will raise it for the hotel team.")

    def _create_ticket_result(
        self,
        db: Session,
        hotel_id: str,
        session: WhatsAppSession,
        intent: ServiceIntent,
        bot_config: BotConfig | None,
    ) -> WhatsAppFlowResult:
        now = datetime.now(timezone.utc)
        department = self._resolve_department(db, hotel_id, intent.department_key)
        assigned_user = self._resolve_assignee(db, hotel_id, department)
        ticket_code = self._next_ticket_code(db, hotel_id)
        ticket = Ticket(
            hotel_id=hotel_id,
            workflow_id="guest-service",
            ticket_code=ticket_code,
            guest_id=session.guest_id,
            room_id=session.room_id,
            department_id=department.id if department is not None else None,
            assigned_to=assigned_user.id if assigned_user is not None else None,
            title=intent.item[:180],
            description=intent.item,
            priority=intent.priority,
            status=TicketStatus.assigned if assigned_user is not None else TicketStatus.created,
            stage="assigned" if assigned_user is not None else "created",
            type="Ticket",
            item_description=intent.item,
            source="whatsapp",
            created_by=session.guest_id or session.id,
            sla_due_at=now + timedelta(minutes=intent.sla_minutes),
        )
        db.add(ticket)
        db.flush()
        db.add(
            TicketHistory(
                hotel_id=hotel_id,
                ticket_id=ticket.id,
                from_stage=None,
                to_stage="created",
                changed_by=session.guest_id,
                changed_at=now.isoformat(),
            )
        )
        if assigned_user is not None:
            db.add(
                TicketAssignment(
                    hotel_id=hotel_id,
                    ticket_id=ticket.id,
                    assigned_to=assigned_user.id,
                    assigned_by=session.guest_id or session.id,
                )
            )
            db.add(
                TicketHistory(
                    hotel_id=hotel_id,
                    ticket_id=ticket.id,
                    from_stage="created",
                    to_stage="assigned",
                    changed_by=session.guest_id,
                    changed_at=now.isoformat(),
                )
            )

        session.state = "active"
        session.pending_action = None
        db.flush()

        assignee = assigned_user.name if assigned_user is not None and assigned_user.name else "hotel team"
        reply = "\n".join(
            [
                "Your request has been raised.",
                f"Request ID: {ticket.ticket_code}",
                f"Item: {intent.item}",
                f"Assigned to: {assignee}",
                f"Expected: within {intent.sla_minutes} mins",
            ]
        )
        return WhatsAppFlowResult(
            session_id=session.id,
            state=session.state,
            reply_text=reply,
            ticket_id=ticket.id,
            ticket_event_payload={
                "event": "ticket.created",
                "ticket_id": ticket.id,
                "ticket_code": ticket.ticket_code,
                "department": department.name if department is not None else None,
                "item": intent.item,
                "guest_id": session.guest_id,
                "room_id": session.room_id,
            },
        )

    def _find_active_guest(self, db: Session, hotel_id: str, phone: str) -> Guest | None:
        phone_values = _phone_variants(phone)
        guests = db.scalars(
            select(Guest).where(
                Guest.tenant_id == hotel_id,
                or_(Guest.phone.in_(phone_values), Guest.whatsapp_phone.in_(phone_values)),
            )
        ).all()
        today = datetime.now(timezone.utc).date()
        for guest in guests:
            if guest.status == "checked_out":
                continue
            if guest.check_out_date:
                try:
                    if datetime.fromisoformat(guest.check_out_date[:10]).date() < today:
                        continue
                except ValueError:
                    pass
            return guest
        return None

    def _resolve_department(self, db: Session, hotel_id: str, department_key: str) -> Department | None:
        candidates = _department_candidates(department_key)
        return db.scalar(
            select(Department).where(
                Department.tenant_id == hotel_id,
                Department.is_active.is_(True),
                or_(
                    func.lower(Department.key).in_(candidates),
                    func.lower(Department.name).in_(candidates),
                ),
            )
        )

    def _resolve_assignee(self, db: Session, hotel_id: str, department: Department | None) -> User | None:
        if department is None:
            return None
        department_values = {department.key.lower(), department.name.lower()}
        return db.scalar(
            select(User)
            .where(
                User.tenant_id == hotel_id,
                User.is_active.is_(True),
                User.is_on_duty.is_(True),
                func.lower(User.department).in_(department_values),
            )
            .order_by(User.created_at.asc())
        )

    def _next_ticket_code(self, db: Session, hotel_id: str) -> str:
        count = db.scalar(select(func.count()).select_from(Ticket).where(Ticket.tenant_id == hotel_id)) or 0
        return f"TCK-{count + 1:06d}"

    def _match_service(self, bot_config: BotConfig | None, text: str, action_id: str | None) -> ServiceIntent | None:
        normalized_text = _normalize(text)
        normalized_action = _normalize(action_id or "")
        for intent in self._service_catalog(bot_config):
            ids = {_normalize(intent.service_id), _normalize(intent.item), *(_normalize(alias) for alias in intent.aliases)}
            if normalized_action and normalized_action in ids:
                return intent
            if normalized_text in ids:
                return intent
            if any(alias and alias in normalized_text for alias in ids):
                return intent
        return None

    def _service_catalog(self, bot_config: BotConfig | None) -> list[ServiceIntent]:
        intents = list(BUILT_IN_SERVICES)
        if bot_config is None or not bot_config.services:
            return intents

        for raw in _iter_service_dicts(bot_config.services):
            service_id = str(raw.get("id") or raw.get("key") or raw.get("service_id") or raw.get("name") or "")
            item = str(raw.get("item") or raw.get("label") or raw.get("name") or service_id)
            if not service_id or not item:
                continue
            aliases_raw = raw.get("aliases") or raw.get("keywords") or []
            if isinstance(aliases_raw, str):
                aliases = (aliases_raw,)
            elif isinstance(aliases_raw, list):
                aliases = tuple(str(alias) for alias in aliases_raw)
            else:
                aliases = ()
            priority = _priority_from_value(raw.get("priority"))
            sla_minutes = _int_or_default(raw.get("sla_minutes") or raw.get("sla"), 30)
            department_key = str(raw.get("department_key") or raw.get("department") or "front-desk")
            intents.insert(0, ServiceIntent(service_id, item, department_key, aliases, priority, sla_minutes))
        return intents

    def _main_menu_text(self, hotel_name: str, session: WhatsAppSession, bot_config: BotConfig | None) -> str:
        guest_name = "there"
        room_label = ""
        if session.pending_action and session.pending_action.get("guest_name"):
            guest_name = session.pending_action["guest_name"]

        title = f"Hi {guest_name}. How can I help?"
        if bot_config is not None and bot_config.main_menu.get("title"):
            title = str(bot_config.main_menu["title"])
        if session.room_id:
            room_label = "Room linked"

        default_lines = [
            title,
            room_label or hotel_name,
            "",
            "1. Food & Beverages",
            "2. Room Services",
            "3. Talk to Manager",
            "4. My Requests",
            "5. Query / Complaint",
        ]
        return "\n".join(line for line in default_lines if line is not None)

    def _welcome_text(self, hotel_name: str, guest: Guest, bot_config: BotConfig | None) -> str:
        return "\n".join(
            [
                f"Welcome, {guest.name}.",
                f"{hotel_name} is ready to help.",
                "",
                self._main_menu_text(hotel_name, WhatsAppSession(hotel_id=guest.hotel_id, phone=guest.whatsapp_phone or guest.phone or "", room_id=guest.room_id), bot_config),
            ]
        )

    def _food_menu_text(self, bot_config: BotConfig | None) -> str:
        if bot_config is not None and bot_config.services.get("food_menu"):
            return str(bot_config.services["food_menu"])
        return "Food & Beverages is available. Please type what you would like to order."

    def _my_requests_text(self, db: Session, hotel_id: str, session: WhatsAppSession) -> str:
        if session.guest_id is None:
            return "I could not find any linked guest requests yet."
        tickets = db.scalars(
            select(Ticket)
            .where(Ticket.tenant_id == hotel_id, Ticket.guest_id == session.guest_id)
            .order_by(Ticket.created_at.desc())
            .limit(5)
        ).all()
        if not tickets:
            return "You do not have any requests yet."
        lines = ["Your recent requests:"]
        for ticket in tickets:
            lines.append(f"{ticket.ticket_code or ticket.id}: {ticket.item_description or ticket.title} - {ticket.stage}")
        return "\n".join(lines)

    @staticmethod
    def _intent_to_payload(intent: ServiceIntent) -> dict[str, Any]:
        return {
            "service_id": intent.service_id,
            "item": intent.item,
            "department_key": intent.department_key,
            "aliases": list(intent.aliases),
            "priority": intent.priority.value,
            "sla_minutes": intent.sla_minutes,
        }

    @staticmethod
    def _intent_from_payload(payload: dict[str, Any]) -> ServiceIntent:
        return ServiceIntent(
            service_id=str(payload["service_id"]),
            item=str(payload["item"]),
            department_key=str(payload["department_key"]),
            aliases=tuple(str(alias) for alias in payload.get("aliases", [])),
            priority=_priority_from_value(payload.get("priority")),
            sla_minutes=_int_or_default(payload.get("sla_minutes"), 30),
        )

    @staticmethod
    def _result(session: WhatsAppSession, reply_text: str) -> WhatsAppFlowResult:
        return WhatsAppFlowResult(session_id=session.id, state=session.state, reply_text=reply_text)


def _iter_service_dicts(value: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if isinstance(value, dict):
        if any(key in value for key in ("id", "key", "service_id", "item", "label", "name")):
            rows.append(value)
        for child in value.values():
            rows.extend(_iter_service_dicts(child))
    elif isinstance(value, list):
        for child in value:
            rows.extend(_iter_service_dicts(child))
    return rows


def _normalize(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def _phone_variants(phone: str) -> list[str]:
    stripped = phone.strip()
    if stripped.startswith("+"):
        return [stripped, stripped[1:]]
    return [stripped, f"+{stripped}"]


def _department_candidates(department_key: str) -> list[str]:
    normalized = department_key.lower().replace("_", "-")
    aliases = {
        "engineering": ["engineering", "maintenance", "eng"],
        "housekeeping": ["housekeeping", "room-service", "room services"],
        "front-desk": ["front-desk", "front desk", "reception", "manager"],
        "kitchen": ["kitchen", "food", "restaurant"],
    }
    return aliases.get(normalized, [normalized, normalized.replace("-", " ")])


def _priority_from_value(value: Any) -> TicketPriority:
    if isinstance(value, TicketPriority):
        return value
    if isinstance(value, int):
        if value >= 3:
            return TicketPriority.urgent
        if value == 2:
            return TicketPriority.high
        return TicketPriority.medium
    try:
        return TicketPriority(str(value))
    except ValueError:
        return TicketPriority.medium


def _int_or_default(value: Any, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default

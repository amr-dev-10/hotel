from datetime import timedelta
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.exceptions import bad_request, not_found
from app.models.guest import Guest
from app.models.reservation import Reservation
from app.models.base import utcnow
from app.models.ticket import Ticket, TicketEvent, TicketMessage
from app.models.user import User
from app.models.whatsapp import WhatsAppConversation
from app.repositories.bot_config_repository import BotConfigRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.knowledge_repository import DepartmentConfigRepository
from app.repositories.routing_rule_repository import RoutingRuleRepository
from app.repositories.ticket_acceptance_repository import TicketAcceptanceRepository
from app.repositories.ticket_repository import TicketMessageRepository, TicketRepository
from app.repositories.user_repository import UserRepository
from app.repositories.workflow_repository import WorkflowDefinitionRepository, WorkflowStateRepository
from app.schemas.ticket import TicketCreate, TicketMessageCreate, TicketTimelineItem
from app.schemas.ops import NotificationCreate
from app.services.audit_service import AuditService
from app.services.hierarchy_service import HierarchyService
from app.services.notification_service import NotificationService
from app.services.ops_service import NotificationCenterService
from app.services.sla_service import SLAService
from app.services.staff_service import ShiftService, StaffService
from app.services.usage_service import UsageService
from app.services.workflow_service import WorkflowService
from app.models.ticket_acceptance import TicketAcceptance


class TicketService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tickets = TicketRepository(db)
        self.ticket_messages = TicketMessageRepository(db)
        self.departments = DepartmentRepository(db)
        self.users = UserRepository(db)
        self.acceptances = TicketAcceptanceRepository(db)
        self.routing_rules = RoutingRuleRepository(db)
        self.workflow_definitions = WorkflowDefinitionRepository(db)
        self.workflow_states = WorkflowStateRepository(db)
        self.bot_configs = BotConfigRepository(db)
        self.department_configs = DepartmentConfigRepository(db)
        self.notifications = NotificationService()
        self.audit = AuditService(db)
        self.slas = SLAService(db)
        self.staff = StaffService(db)
        self.hierarchy = HierarchyService(db)

    def create_ticket(
        self,
        hotel_id: str,
        payload: TicketCreate,
        actor_id: str | None = None,
        commit: bool = True,
    ) -> Ticket:
        UsageService(self.db).check_and_increment(hotel_id, "tickets", commit=False)
        self._validate_context(hotel_id, payload)
        department = None
        if payload.department_id:
            department = self.departments.get_for_hotel(hotel_id, payload.department_id)
        if not department and payload.department_key:
            department = self.departments.get_by_key(hotel_id, payload.department_key)
        if not department:
            department = self.departments.first_active(hotel_id)
        if not department:
            raise not_found("No active department exists for this hotel")

        assignee = None
        if payload.assigned_to:
            assignee = self.users.get_for_hotel(hotel_id, payload.assigned_to)
        now = utcnow()
        routing_rule = self.routing_rules.find_for_type(hotel_id, payload.type)
        fast_tracked = bool(routing_rule and routing_rule.skip_normal_assignment)
        if fast_tracked and routing_rule:
            if routing_rule.target_user_id:
                assignee = self.users.get_for_hotel(hotel_id, routing_rule.target_user_id)
            else:
                assignee = self.staff.find_by_level(
                    hotel_id,
                    routing_rule.target_staff_level,
                    department.id,
                ) or self.staff.find_by_level(hotel_id, routing_rule.target_staff_level)
        if not assignee and not fast_tracked:
            assignee = ShiftService(self.db).find_available_staff(
                hotel_id,
                department.id,
                now.date(),
                now.time(),
            )
        if not assignee:
            assignee = self.staff.find_available(hotel_id, department.id) or self.users.first_on_duty_for_department(
                hotel_id, department.id
            )

        initial_stage = self._initial_ticket_stage(hotel_id)
        uses_acceptance = bool(assignee and self._supports_state(hotel_id, "pending_accept"))
        sla_config = self.slas.get_sla_config(hotel_id, department.id, payload.task_category)
        ticket = Ticket(
            hotel_id=hotel_id,
            ticket_code=self._ticket_code(),
            guest_id=payload.guest_id,
            reservation_id=payload.reservation_id,
            conversation_id=payload.conversation_id,
            room_id=payload.room_id,
            department_id=department.id,
            assigned_to=None if uses_acceptance else (assignee.id if assignee else None),
            stage=initial_stage,
            type=payload.type,
            task_category=payload.task_category,
            item_description=payload.item_description,
            source=self._normalize_source(payload.source),
            followers=list(dict.fromkeys([*payload.followers, *([assignee.id] if assignee else [])])),
            priority=(routing_rule.priority_override if fast_tracked and routing_rule and routing_rule.priority_override else payload.priority),
            sla_due_at=None if uses_acceptance else now + timedelta(minutes=sla_config.sla_minutes),
        )
        self.db.add(ticket)
        self.db.flush()
        self.tickets.add_event(
            ticket,
            "created",
            {
                "source": ticket.source,
                "guest_id": payload.guest_id,
                "reservation_id": payload.reservation_id,
                "conversation_id": payload.conversation_id,
                "item_description": payload.item_description,
                "priority": payload.priority,
                "task_category": payload.task_category,
            },
            actor_id=actor_id,
        )
        if fast_tracked and routing_rule:
            self.tickets.add_event(
                ticket,
                "fast_tracked",
                {
                    "reason": f"routing_rule:{routing_rule.ticket_type}",
                    "routed_to": assignee.name if assignee else "unassigned",
                    "target_staff_level": routing_rule.target_staff_level,
                    "skipped_levels": ["attendant", "supervisor", "manager"],
                },
                actor_id=actor_id,
            )
        if ticket.assigned_to is None:
            from app.services.dispatch_service import DispatchService

            DispatchService(self.db).dispatch_ticket(
                ticket,
                preferred_user_id=assignee.id if assignee else None,
                commit=False,
            )
        elif assignee:
            self.tickets.add_event(
                ticket,
                "assigned",
                {"assigned_to": assignee.id, "assigned_to_name": assignee.name},
                actor_id=actor_id,
            )
        if department.key == "engineering":
            from app.services.pms_service import MaintenanceService

            MaintenanceService(self.db).create_from_ticket(ticket, commit=False)
            self.tickets.add_event(
                ticket,
                "maintenance_order_created",
                {"department_key": department.key},
                actor_id=actor_id,
            )
        if commit:
            self.audit.log(
                hotel_id,
                "ticket.created",
                "ticket",
                ticket.id,
                actor_id,
                {"ticket_code": ticket.ticket_code, "source": ticket.source},
            )
            if assignee:
                self.audit.log(
                    hotel_id,
                    "ticket.assigned",
                    "ticket",
                    ticket.id,
                    actor_id,
                    {"assigned_to": assignee.id},
                )
                NotificationCenterService(self.db).create(
                    hotel_id,
                    NotificationCreate(
                        user_id=assignee.id,
                        channel="fcm",
                        title="New Ticket",
                        message=ticket.item_description,
                    ),
                    commit=False,
                )
            self.db.commit()
            self.db.refresh(ticket)
            self._publish_created(ticket, assignee_name=assignee.name if assignee else None)
        return ticket

    def list_messages(self, hotel_id: str, ticket_id: str) -> list[TicketMessage]:
        self._get_ticket(hotel_id, ticket_id)
        return list(self.ticket_messages.list_for_ticket(hotel_id, ticket_id))

    def create_message(
        self,
        hotel_id: str,
        ticket_id: str,
        payload: TicketMessageCreate,
        actor_id: str | None,
    ) -> TicketMessage:
        ticket = self._get_ticket(hotel_id, ticket_id)
        message = TicketMessage(
            hotel_id=hotel_id,
            ticket_id=ticket.id,
            sender_type=payload.sender_type,
            sender_id=actor_id,
            content=payload.content,
            is_read=False,
            created_at=utcnow(),
        )
        self.db.add(message)
        self.db.commit()
        self.db.refresh(message)
        return message

    def timeline(self, hotel_id: str, ticket_id: str) -> list[TicketTimelineItem]:
        self._get_ticket(hotel_id, ticket_id)
        events = self.db.execute(
            select(TicketEvent).where(
                TicketEvent.hotel_id == hotel_id,
                TicketEvent.ticket_id == ticket_id,
            )
        ).scalars().all()
        messages = self.ticket_messages.list_for_ticket(hotel_id, ticket_id)
        items = [
            TicketTimelineItem(
                id=event.id,
                item_type="event",
                event_type=event.event_type,
                content=self._event_label(event.event_type),
                payload=event.payload,
                created_at=event.created_at,
            )
            for event in events
        ]
        items.extend(
            TicketTimelineItem(
                id=message.id,
                item_type="message",
                sender_type=message.sender_type,
                sender_id=message.sender_id,
                content=message.content,
                payload=None,
                created_at=message.created_at,
            )
            for message in messages
        )
        return sorted(items, key=lambda item: item.created_at)

    def offer_ticket(
        self,
        ticket_id: str,
        offered_to: str,
        actor_id: str | None = None,
        commit: bool = True,
    ) -> TicketAcceptance:
        ticket = self.tickets.get(ticket_id)
        if not ticket:
            raise not_found("Ticket not found")
        user = self.users.get_for_hotel(ticket.hotel_id, offered_to)
        if not user:
            raise not_found("User not found")
        current = self.acceptances.current_pending(ticket.id)
        if current:
            current.response = "expired"
            current.auto_expired = True
            current.responded_at = utcnow()
        config = self.slas.get_sla_config(ticket.hotel_id, ticket.department_id, ticket.task_category)
        acceptance = TicketAcceptance(
            ticket_id=ticket.id,
            offered_to=offered_to,
            offered_at=utcnow(),
            response="pending",
            expire_after_minutes=config.accept_timeout_minutes,
        )
        self.db.add(acceptance)
        ticket.assigned_to = offered_to
        if self._supports_state(ticket.hotel_id, "pending_accept"):
            ticket.stage = "pending_accept"
        ticket.sla_due_at = None
        self.tickets.add_event(
            ticket,
            "offered",
            {
                "offered_to": offered_to,
                "offered_to_name": user.name,
                "expire_after_minutes": config.accept_timeout_minutes,
            },
            actor_id=actor_id,
        )
        NotificationCenterService(self.db).create(
            ticket.hotel_id,
            NotificationCreate(
                user_id=offered_to,
                channel="fcm",
                title="New Ticket - Accept?",
                message=ticket.item_description,
                metadata={
                    "type": "ticket_offer",
                    "ticket_id": ticket.id,
                    "timeout_seconds": config.accept_timeout_minutes * 60,
                    "action_buttons": ["accept", "reject"],
                },
            ),
            commit=False,
        )
        if commit:
            self.db.commit()
            self.db.refresh(acceptance)
        return acceptance

    def accept_ticket(self, hotel_id: str, ticket_id: str, user_id: str) -> Ticket:
        from app.services.dispatch_service import DispatchService

        return DispatchService(self.db).handle_acceptance(hotel_id, ticket_id, user_id)

    def reject_ticket(self, hotel_id: str, ticket_id: str, user_id: str, reason: str | None = None) -> Ticket:
        from app.services.dispatch_service import DispatchService

        return DispatchService(self.db).handle_rejection(hotel_id, ticket_id, user_id, reason)

    def complete_ticket(self, hotel_id: str, ticket_id: str, user_id: str) -> Ticket:
        ticket = self._get_ticket(hotel_id, ticket_id)
        if ticket.assigned_to and ticket.assigned_to != user_id:
            raise bad_request("Only the assigned user can complete this ticket")
        old_stage = ticket.stage
        ticket.stage = "pending_approval"
        self.tickets.add_event(
            ticket,
            "completed_pending_approval",
            {"from": old_stage, "to": ticket.stage},
            actor_id=user_id,
        )
        self.audit.log(hotel_id, "ticket.completed", "ticket", ticket.id, user_id)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def approve_ticket(self, hotel_id: str, ticket_id: str, actor_id: str) -> Ticket:
        ticket = self._get_ticket(hotel_id, ticket_id)
        old_stage = ticket.stage
        ticket.stage = "approved"
        ticket.resolved_at = ticket.resolved_at or utcnow()
        self.tickets.add_event(
            ticket,
            "approved",
            {"from": old_stage, "to": ticket.stage},
            actor_id=actor_id,
        )
        self.audit.log(hotel_id, "ticket.approved", "ticket", ticket.id, actor_id)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def reopen_ticket(self, hotel_id: str, ticket_id: str, actor_id: str, note: str | None = None) -> Ticket:
        ticket = self._get_ticket(hotel_id, ticket_id)
        old_stage = ticket.stage
        ticket.stage = "reopened"
        ticket.resolved_at = None
        self.tickets.add_event(
            ticket,
            "reopened",
            {"from": old_stage, "to": ticket.stage, "note": note},
            actor_id=actor_id,
        )
        self.audit.log(hotel_id, "ticket.reopened", "ticket", ticket.id, actor_id, {"note": note})
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def expire_pending_acceptances(self) -> list[Ticket]:
        from app.services.dispatch_service import DispatchService

        logs = DispatchService(self.db).check_expired_offers()
        ticket_ids = {log.ticket_id for log in logs}
        return [ticket for ticket_id in ticket_ids if (ticket := self.tickets.get(ticket_id))]

    def update_stage(
        self,
        hotel_id: str,
        ticket_id: str,
        stage: str,
        note: str | None = None,
        actor_id: str | None = None,
        actor: User | None = None,
    ) -> Ticket:
        ticket = self.tickets.get_for_hotel(hotel_id, ticket_id)
        if not ticket:
            raise not_found("Ticket not found")
        effective_actor_id = actor.id if actor else actor_id
        workflow_ticket = WorkflowService(self.db).change_ticket_stage(ticket, stage, actor)
        if workflow_ticket:
            ticket = workflow_ticket
            if note:
                self.tickets.add_event(
                    ticket,
                    "stage_note",
                    {"stage": ticket.stage, "note": note},
                    actor_id=effective_actor_id,
                )
        else:
            ticket.stage = stage
            if stage.lower() in {"completed", "resolved", "closed"}:
                ticket.stage = "Completed"
                ticket.resolved_at = utcnow()
            self.tickets.add_event(
                ticket,
                "stage_changed",
                {"stage": ticket.stage, "note": note},
                actor_id=effective_actor_id,
            )
        self.audit.log(
            hotel_id,
            "ticket.resolved" if ticket.stage == "Completed" else "ticket.stage_changed",
            "ticket",
            ticket.id,
            effective_actor_id,
            {"stage": ticket.stage, "note": note},
        )
        self.db.commit()
        self.db.refresh(ticket)
        self.notifications.publish_ticket_event(
            hotel_id,
            {
                "event": "ticket.stage_changed",
                "ticket_id": ticket.id,
                "stage": ticket.stage,
                "note": note,
            },
        )
        return ticket

    def _sla_minutes(self, hotel_id: str, department_key: str) -> int:
        department = self.departments.get_by_key(hotel_id, department_key)
        if department:
            department_config = self.department_configs.get_for_department(hotel_id, department.id)
            if department_config:
                return department_config.sla_minutes
        config = self.bot_configs.get_for_hotel(hotel_id)
        if config and config.sla_config:
            value = config.sla_config.get(department_key, config.sla_config.get("default"))
            if isinstance(value, int):
                return value
            if isinstance(value, str) and value.isdigit():
                return int(value)
        return 20

    def _get_ticket(self, hotel_id: str, ticket_id: str) -> Ticket:
        ticket = self.tickets.get_for_hotel(hotel_id, ticket_id)
        if not ticket:
            raise not_found("Ticket not found")
        return ticket

    def _validate_context(self, hotel_id: str, payload: TicketCreate) -> None:
        if payload.guest_id and not self.db.execute(
            select(Guest.id).where(Guest.hotel_id == hotel_id, Guest.id == payload.guest_id)
        ).scalar_one_or_none():
            raise not_found("Guest not found")
        if payload.reservation_id and not self.db.execute(
            select(Reservation.id).where(
                Reservation.hotel_id == hotel_id,
                Reservation.id == payload.reservation_id,
                Reservation.deleted_at.is_(None),
            )
        ).scalar_one_or_none():
            raise not_found("Reservation not found")
        if payload.conversation_id and not self.db.execute(
            select(WhatsAppConversation.id).where(
                WhatsAppConversation.hotel_id == hotel_id,
                WhatsAppConversation.id == payload.conversation_id,
            )
        ).scalar_one_or_none():
            raise not_found("WhatsApp conversation not found")

    def _normalize_source(self, source: str) -> str:
        normalized = source.strip()
        mapping = {
            "dashboard": "DASHBOARD",
            "whatsapp": "WHATSAPP",
            "staff": "STAFF",
            "email": "EMAIL",
            "phone": "PHONE",
            "walk_in": "WALK_IN",
            "walk-in": "WALK_IN",
        }
        return mapping.get(normalized.lower(), normalized)

    def _event_label(self, event_type: str) -> str:
        return event_type.replace("_", " ").replace(".", " ").title()

    def _offer_next_after_decline(
        self,
        ticket: Ticket,
        user_id: str,
        actor_id: str | None = None,
    ) -> None:
        excluded = set(self.acceptances.declined_user_ids(ticket.id))
        excluded.add(user_id)
        next_user = self.staff.find_available(
            ticket.hotel_id,
            ticket.department_id,
            staff_level="attendant",
            exclude_users=excluded,
        )
        if not next_user:
            next_user = self.hierarchy.get_superior_at_level(user_id, "supervisor")
        if not next_user:
            next_user = self.hierarchy.get_superior_at_level(user_id, "manager")
        if next_user:
            self.offer_ticket(ticket.id, next_user.id, actor_id=actor_id, commit=False)
            return
        ticket.assigned_to = None
        ticket.stage = "pending_accept" if self._supports_state(ticket.hotel_id, "pending_accept") else ticket.stage
        self.tickets.add_event(
            ticket,
            "offer_exhausted",
            {"excluded_user_ids": list(excluded)},
            actor_id=actor_id,
        )

    def _initial_ticket_stage(self, hotel_id: str) -> str:
        workflow = self.workflow_definitions.default_for_entity(hotel_id, "ticket")
        if not workflow:
            return "Open"
        states = self.workflow_states.list_for_workflow(workflow.id)
        initial = next((state for state in states if state.state_type == "initial"), None)
        return initial.state_key if initial else "Open"

    def _supports_state(self, hotel_id: str, state_key: str) -> bool:
        workflow = self.workflow_definitions.default_for_entity(hotel_id, "ticket")
        if not workflow:
            return False
        return self.workflow_states.get_by_key(workflow.id, state_key) is not None

    def _ticket_code(self) -> str:
        return f"REQ-{utcnow().strftime('%H%M%S-%d%m%y')}-{uuid4().hex[:4].upper()}"

    def _publish_created(self, ticket: Ticket, assignee_name: str | None) -> None:
        self.notifications.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.created",
                "ticket_id": ticket.id,
                "ticket_code": ticket.ticket_code,
                "department_id": ticket.department_id,
                "room_id": ticket.room_id,
                "guest_id": ticket.guest_id,
                "reservation_id": ticket.reservation_id,
                "conversation_id": ticket.conversation_id,
                "item": ticket.item_description,
                "assigned_to": ticket.assigned_to,
                "assigned_to_name": assignee_name,
                "sla_due_at": ticket.sla_due_at,
            },
        )
        self.notifications.send_fcm_to_user(
            ticket.assigned_to,
            "New Ticket",
            ticket.item_description,
            {"ticket_id": ticket.id, "hotel_id": ticket.hotel_id},
        )

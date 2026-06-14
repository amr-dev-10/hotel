from datetime import timedelta
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.ticket import Ticket
from app.models.user import User
from app.repositories.bot_config_repository import BotConfigRepository
from app.repositories.department_repository import DepartmentRepository
from app.repositories.knowledge_repository import DepartmentConfigRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.schemas.ticket import TicketCreate
from app.schemas.ops import NotificationCreate
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.services.ops_service import NotificationCenterService
from app.services.staff_service import ShiftService
from app.services.usage_service import UsageService
from app.services.workflow_service import WorkflowService


class TicketService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tickets = TicketRepository(db)
        self.departments = DepartmentRepository(db)
        self.users = UserRepository(db)
        self.bot_configs = BotConfigRepository(db)
        self.department_configs = DepartmentConfigRepository(db)
        self.notifications = NotificationService()
        self.audit = AuditService(db)

    def create_ticket(
        self,
        hotel_id: str,
        payload: TicketCreate,
        actor_id: str | None = None,
        commit: bool = True,
    ) -> Ticket:
        UsageService(self.db).check_and_increment(hotel_id, "tickets", commit=False)
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
        if not assignee:
            assignee = ShiftService(self.db).find_available_staff(
                hotel_id,
                department.id,
                now.date(),
                now.time(),
            )
        if not assignee:
            assignee = self.users.first_on_duty_for_department(hotel_id, department.id)

        ticket = Ticket(
            hotel_id=hotel_id,
            ticket_code=self._ticket_code(),
            guest_id=payload.guest_id,
            room_id=payload.room_id,
            department_id=department.id,
            assigned_to=assignee.id if assignee else None,
            stage="Open",
            type=payload.type,
            item_description=payload.item_description,
            source=payload.source,
            priority=payload.priority,
            sla_due_at=now + timedelta(minutes=self._sla_minutes(hotel_id, department.key)),
        )
        self.db.add(ticket)
        self.db.flush()
        self.tickets.add_event(
            ticket,
            "created",
            {
                "source": payload.source,
                "item_description": payload.item_description,
                "priority": payload.priority,
            },
            actor_id=actor_id,
        )
        if assignee:
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

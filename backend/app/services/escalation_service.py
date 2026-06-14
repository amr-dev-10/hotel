from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.escalation import EscalationLog, EscalationRule
from app.models.ticket import Ticket
from app.repositories.escalation_repository import EscalationLogRepository, EscalationRuleRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.schemas.ops import NotificationCreate
from app.schemas.v51 import EscalationRuleCreate, EscalationRuleUpdate
from app.services.hierarchy_service import HierarchyService
from app.services.ops_service import NotificationCenterService
from app.services.sla_service import SLAService
from app.services.staff_service import StaffService


DEFAULT_ESCALATION_RULES = [
    ("supervisor", 1, True),
    ("manager", 2, False),
    ("admin", 3, False),
]


class EscalationRuleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.rules = EscalationRuleRepository(db)

    def create(self, hotel_id: str, payload: EscalationRuleCreate) -> EscalationRule:
        rule = EscalationRule(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def update(self, hotel_id: str, rule_id: str, payload: EscalationRuleUpdate) -> EscalationRule:
        rule = self.rules.get_for_hotel(hotel_id, rule_id)
        if not rule:
            raise not_found("Escalation rule not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(rule, key, value)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete(self, hotel_id: str, rule_id: str) -> None:
        rule = self.rules.get_for_hotel(hotel_id, rule_id)
        if not rule:
            raise not_found("Escalation rule not found")
        rule.is_active = False
        self.db.commit()

    def seed_defaults(self, hotel_id: str) -> None:
        existing = self.rules.list_active(hotel_id)
        for target_level, level, auto_reassign in DEFAULT_ESCALATION_RULES:
            if any(rule.escalation_level == level and rule.department_id is None for rule in existing):
                continue
            self.db.add(
                EscalationRule(
                    hotel_id=hotel_id,
                    escalation_level=level,
                    trigger_after_minutes=0,
                    action="escalate_up",
                    target_staff_level=target_level,
                    auto_reassign=auto_reassign,
                    send_notification=True,
                    notification_channels=["fcm", "websocket"],
                    is_active=True,
                )
            )


class EscalationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tickets = TicketRepository(db)
        self.rules = EscalationRuleRepository(db)
        self.logs = EscalationLogRepository(db)
        self.users = UserRepository(db)
        self.hierarchy = HierarchyService(db)
        self.staff = StaffService(db)
        self.slas = SLAService(db)
        self.notifications = NotificationCenterService(db)

    def check_escalations(self, hotel_id: str | None = None) -> list[EscalationLog]:
        fired: list[EscalationLog] = []
        now = utcnow()
        for ticket in self.tickets.list_unresolved(hotel_id):
            max_level = self.logs.max_level_for_ticket(ticket.id)
            next_level = max_level + 1
            rule = self.rules.find_matching(
                ticket.hotel_id,
                ticket.department_id,
                ticket.type,
                ticket.task_category,
                next_level,
            )
            if not rule:
                continue
            trigger_minutes = self._effective_trigger_minutes(ticket, rule)
            age_minutes = (now - ticket.created_at).total_seconds() / 60
            if age_minutes < trigger_minutes:
                continue
            fired.append(self.fire_rule(ticket, rule, "sla_breach"))
        if fired:
            self.db.commit()
            for row in fired:
                self.db.refresh(row)
        return fired

    def fire_rule(self, ticket: Ticket, rule: EscalationRule, reason: str, notes: str | None = None) -> EscalationLog:
        old_assignee = ticket.assigned_to
        target = None
        if rule.action == "escalate_up" and old_assignee:
            target = self.hierarchy.get_superior_at_level(old_assignee, rule.target_staff_level)
        if not target and rule.target_staff_level:
            target = self.staff.find_by_level(ticket.hotel_id, rule.target_staff_level, ticket.department_id)
        if not target and rule.auto_reassign:
            target = self.staff.find_available(
                ticket.hotel_id,
                ticket.department_id,
                exclude_users=[old_assignee] if old_assignee else [],
            )
        if rule.auto_reassign and target:
            ticket.assigned_to = target.id
        if rule.send_notification and target:
            self.notifications.create(
                ticket.hotel_id,
                NotificationCreate(
                    user_id=target.id,
                    channel="fcm",
                    title=f"Escalation Level {rule.escalation_level}",
                    message=f"{ticket.ticket_code}: {ticket.item_description}",
                    metadata={"ticket_id": ticket.id, "reason": reason},
                ),
                commit=False,
            )
        log = EscalationLog(
            ticket_id=ticket.id,
            rule_id=rule.id,
            escalation_level=rule.escalation_level,
            escalated_from=old_assignee,
            escalated_to=target.id if target else None,
            reason=reason,
            notes=notes,
        )
        self.db.add(log)
        self.tickets.add_event(
            ticket,
            "escalated",
            {
                "level": rule.escalation_level,
                "from": old_assignee,
                "to": target.id if target else None,
                "reason": reason,
            },
            commit=False,
        )
        return log

    def _effective_trigger_minutes(self, ticket: Ticket, rule: EscalationRule) -> int:
        if rule.trigger_after_minutes > 0:
            return rule.trigger_after_minutes
        sla = self.slas.get_sla_config(ticket.hotel_id, ticket.department_id, ticket.task_category)
        return sla.sla_minutes * rule.escalation_level

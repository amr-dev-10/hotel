from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.escalation import EscalationLog, EscalationRule
from app.models.ticket import Ticket
from app.repositories.escalation_repository import EscalationLogRepository, EscalationRuleRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.ticket_category_repository import TicketCategoryRepository
from app.repositories.user_repository import UserRepository
from app.schemas.ops import NotificationCreate
from app.schemas.v51 import EscalationRuleCreate, EscalationRuleUpdate
from app.services.hierarchy_service import HierarchyService
from app.services.ops_service import NotificationCenterService
from app.services.sla_service import SLAService
from app.services.staff_service import StaffService


DEFAULT_ESCALATION_RULES = [
    ("supervisor", 1, 0, True),
    ("manager", 2, 10, True),
    ("admin", 3, 20, False),
]


class EscalationRuleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.rules = EscalationRuleRepository(db)
        self.categories = TicketCategoryRepository(db)

    def create(self, hotel_id: str, payload: EscalationRuleCreate) -> EscalationRule:
        data = self._normalized_payload(hotel_id, payload.model_dump())
        rule = EscalationRule(hotel_id=hotel_id, **data)
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def update(self, hotel_id: str, rule_id: str, payload: EscalationRuleUpdate) -> EscalationRule:
        rule = self.rules.get_for_hotel(hotel_id, rule_id)
        if not rule:
            raise not_found("Escalation rule not found")
        for key, value in self._normalized_payload(hotel_id, payload.model_dump(exclude_unset=True)).items():
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
        self._seed_common_rules(hotel_id, reset=False)

    def _normalized_payload(self, hotel_id: str, data: dict) -> dict:
        category_id = data.get("task_category_id")
        if category_id:
            category = self.categories.get_for_hotel(hotel_id, category_id)
            if not category or not category.is_active:
                raise not_found("Ticket category not found")
            data["task_category_id"] = category.id
            data["task_category"] = category.key
            data.setdefault("department_id", category.department_id)
        elif data.get("task_category"):
            category = self.categories.get_by_key(hotel_id, data["task_category"])
            if category:
                data["task_category_id"] = category.id
                data["task_category"] = category.key
                data.setdefault("department_id", category.department_id)
        return data

    def reset_defaults(self, hotel_id: str) -> list[EscalationRule]:
        for rule in self.rules.list_active(hotel_id):
            rule.is_active = False
        rows = self._seed_common_rules(hotel_id, reset=True)
        self.db.commit()
        for row in rows:
            self.db.refresh(row)
        return rows

    def _seed_common_rules(self, hotel_id: str, reset: bool) -> list[EscalationRule]:
        created: list[EscalationRule] = []
        existing = self.rules.list_active(hotel_id)
        for target_level, level, minutes_after_due, auto_reassign in DEFAULT_ESCALATION_RULES:
            if not reset and any(rule.escalation_level == level and rule.department_id is None for rule in existing):
                continue
            created.append(
                self._add_rule(
                    hotel_id=hotel_id,
                    escalation_level=level,
                    trigger_after_minutes=minutes_after_due,
                    target_staff_level=target_level,
                    auto_reassign=auto_reassign,
                )
            )
        for category_key, target_level, level, minutes_after_due in (
            ("guest_request", "supervisor", 1, 0),
            ("complaint", "manager", 1, 0),
            ("towel_request", "supervisor", 1, 0),
            ("housekeeping", "supervisor", 1, 0),
            ("maintenance", "supervisor", 1, 0),
            ("ac_repair", "supervisor", 1, 0),
            ("room_service", "supervisor", 1, 0),
            ("food_order", "supervisor", 1, 0),
        ):
            category = self.categories.get_by_key(hotel_id, category_key)
            if not category:
                continue
            if not reset and any(
                rule.escalation_level == level
                and rule.task_category_id == category.id
                and rule.department_id == category.department_id
                for rule in existing
            ):
                continue
            created.append(
                self._add_rule(
                    hotel_id=hotel_id,
                    department_id=category.department_id,
                    task_category_id=category.id,
                    task_category=category.key,
                    escalation_level=level,
                    trigger_after_minutes=minutes_after_due,
                    target_staff_level=target_level,
                    auto_reassign=True,
                )
            )
        return created

    def _add_rule(
        self,
        hotel_id: str,
        escalation_level: int,
        trigger_after_minutes: int,
        target_staff_level: str,
        auto_reassign: bool,
        department_id: str | None = None,
        task_category_id: str | None = None,
        task_category: str | None = None,
    ) -> EscalationRule:
        statement = select(EscalationRule).where(
            EscalationRule.hotel_id == hotel_id,
            EscalationRule.escalation_level == escalation_level,
            EscalationRule.ticket_type.is_(None),
        )
        if department_id:
            statement = statement.where(EscalationRule.department_id == department_id)
        else:
            statement = statement.where(EscalationRule.department_id.is_(None))
        if task_category:
            statement = statement.where(EscalationRule.task_category == task_category)
        else:
            statement = statement.where(EscalationRule.task_category.is_(None))
        existing = self.db.execute(statement).scalars().first()
        if existing:
            existing.task_category_id = task_category_id
            existing.trigger_after_minutes = trigger_after_minutes
            existing.action = "escalate_up"
            existing.target_staff_level = target_staff_level
            existing.auto_reassign = auto_reassign
            existing.send_notification = True
            existing.notification_channels = ["fcm", "websocket"]
            existing.is_active = True
            return existing
        row = EscalationRule(
            hotel_id=hotel_id,
            department_id=department_id,
            task_category_id=task_category_id,
            task_category=task_category,
            escalation_level=escalation_level,
            trigger_after_minutes=trigger_after_minutes,
            action="escalate_up",
            target_staff_level=target_staff_level,
            auto_reassign=auto_reassign,
            send_notification=True,
            notification_channels=["fcm", "websocket"],
            is_active=True,
        )
        self.db.add(row)
        return row


class EscalationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tickets = TicketRepository(db)
        self.rules = EscalationRuleRepository(db)
        self.logs = EscalationLogRepository(db)
        self.users = UserRepository(db)
        self.categories = TicketCategoryRepository(db)
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
                ticket.task_category_id,
                next_level,
            )
            if not rule:
                continue
            due_at = self._escalation_due_at(ticket, rule)
            if due_at is None or now < due_at:
                continue
            fired.append(self.fire_rule(ticket, rule, "sla_breach"))
        from app.services.dispatch_service import DispatchService

        fired.extend(DispatchService(self.db).check_expired_offers(hotel_id))
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
                    notification_type="escalation",
                    reference_id=ticket.id,
                    metadata={
                        "event": "ticket_escalated",
                        "priority": ticket.priority,
                        "reason": reason,
                        "room_id": ticket.room_id,
                        "ticket_code": ticket.ticket_code,
                        "ticket_id": ticket.id,
                    },
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
        sla = self.slas.get_sla_config(
            ticket.hotel_id,
            ticket.department_id,
            ticket.task_category,
            ticket.task_category_id,
        )
        return sla.sla_minutes * rule.escalation_level

    def _escalation_due_at(self, ticket: Ticket, rule: EscalationRule):
        if not ticket.sla_due_at:
            return None
        from datetime import timedelta

        if rule.trigger_after_minutes > 0:
            return ticket.sla_due_at + timedelta(minutes=rule.trigger_after_minutes)
        if rule.escalation_level <= 1:
            return ticket.sla_due_at
        sla = self.slas.get_sla_config(
            ticket.hotel_id,
            ticket.department_id,
            ticket.task_category,
            ticket.task_category_id,
        )
        return ticket.sla_due_at + timedelta(minutes=sla.sla_minutes * (rule.escalation_level - 1))

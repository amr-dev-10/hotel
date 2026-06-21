from collections import defaultdict
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.escalation import EscalationLog, EscalationRule
from app.models.ticket import Ticket
from app.models.ticket_acceptance import TicketAcceptance
from app.models.user import User
from app.repositories.escalation_repository import EscalationLogRepository, EscalationRuleRepository
from app.repositories.ticket_acceptance_repository import TicketAcceptanceRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.user_repository import UserRepository
from app.schemas.ops import NotificationCreate
from app.services.notification_service import NotificationService
from app.services.ops_service import NotificationCenterService
from app.services.sla_service import SLAService


class DispatchService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tickets = TicketRepository(db)
        self.acceptances = TicketAcceptanceRepository(db)
        self.rules = EscalationRuleRepository(db)
        self.logs = EscalationLogRepository(db)
        self.users = UserRepository(db)
        self.notifications = NotificationCenterService(db)
        self.realtime = NotificationService()
        self.slas = SLAService(db)

    def dispatch_ticket(
        self,
        ticket: Ticket,
        staff_level: str | None = None,
        escalation_rule: EscalationRule | None = None,
        preferred_user_id: str | None = None,
        reason: str = "ticket_dispatch",
        commit: bool = True,
    ) -> list[TicketAcceptance]:
        level = staff_level or self._initial_staff_level(ticket)
        excluded = set(self.acceptances.declined_user_ids(ticket.id))
        excluded.update(row.offered_to for row in self.acceptances.pending_for_ticket(ticket.id))
        staff = self._find_eligible_staff(ticket, level, excluded)
        staff = self._with_preferred_staff(ticket, staff, preferred_user_id, excluded)
        if not staff:
            if commit:
                self.db.commit()
            return []

        timeout = self._offer_timeout_minutes(ticket, escalation_rule)
        created: list[TicketAcceptance] = []
        now = utcnow()
        for user in staff:
            acceptance = TicketAcceptance(
                ticket_id=ticket.id,
                offered_to=user.id,
                offered_at=now,
                response="pending",
                expire_after_minutes=timeout,
            )
            self.db.add(acceptance)
            self.db.flush()
            created.append(acceptance)
            self._notify_dispatch(ticket, user, acceptance, reason)

        ticket.assigned_to = created[0].offered_to
        ticket.stage = "pending_accept"
        ticket.sla_due_at = None
        self.tickets.add_event(
            ticket,
            "dispatch_broadcast",
            {
                "staff_level": level,
                "offered_to": [user.id for user in staff],
                "expire_after_minutes": timeout,
                "reason": reason,
            },
            commit=False,
        )
        self.realtime.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.dispatch_broadcast",
                "ticket_id": ticket.id,
                "staff_level": level,
                "offered_to": [user.id for user in staff],
            },
        )
        if commit:
            self.db.commit()
            for row in created:
                self.db.refresh(row)
            self.db.refresh(ticket)
        return created

    def handle_acceptance(self, hotel_id: str, ticket_id: str, user_id: str) -> Ticket:
        ticket = self._get_ticket(hotel_id, ticket_id)
        now = utcnow()
        acceptance = self.acceptances.update_response(ticket.id, user_id, "accepted", now)
        if not acceptance and ticket.assigned_to != user_id:
            raise bad_request("Ticket is not pending acceptance for this user")
        config = self.slas.get_sla_config(ticket.hotel_id, ticket.department_id, ticket.task_category)
        ticket.assigned_to = user_id
        ticket.stage = "accepted"
        ticket.sla_due_at = now + timedelta(minutes=config.sla_minutes)
        cancelled = self.acceptances.cancel_pending(ticket.id, except_user_id=user_id, responded_at=now)
        self.tickets.add_event(
            ticket,
            "accepted",
            {"accepted_by": user_id, "sla_minutes": config.sla_minutes},
            actor_id=user_id,
            commit=False,
        )
        self.db.commit()
        self.db.refresh(ticket)
        self.realtime.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.assigned",
                "ticket_id": ticket.id,
                "assigned_to": user_id,
                "stage": ticket.stage,
            },
        )
        for row in cancelled:
            self.realtime.publish_user_notification(
                ticket.hotel_id,
                row.offered_to,
                {
                    "event": "ticket_assigned",
                    "ticket_id": ticket.id,
                    "assigned_to": user_id,
                },
            )
        return ticket

    def handle_rejection(
        self,
        hotel_id: str,
        ticket_id: str,
        user_id: str,
        reason: str | None = None,
    ) -> Ticket:
        ticket = self._get_ticket(hotel_id, ticket_id)
        acceptance = self.acceptances.update_response(
            ticket.id,
            user_id,
            "rejected",
            utcnow(),
            rejection_reason=reason,
        )
        if not acceptance and ticket.assigned_to != user_id:
            raise bad_request("Ticket is not pending acceptance for this user")
        self.tickets.add_event(
            ticket,
            "rejected",
            {"rejected_by": user_id, "reason": reason},
            actor_id=user_id,
            commit=False,
        )
        if not self.acceptances.pending_for_ticket(ticket.id):
            self._escalate_to_next_level(ticket, "rejected_by_all")
        self.db.commit()
        self.db.refresh(ticket)
        self.realtime.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.rejected",
                "ticket_id": ticket.id,
                "rejected_by": user_id,
            },
        )
        return ticket

    def check_expired_offers(self, hotel_id: str | None = None) -> list[EscalationLog]:
        now = utcnow()
        due = self.acceptances.pending_due(now, hotel_id=hotel_id)
        tickets_by_id: dict[str, Ticket] = {}
        for acceptance in due:
            ticket = self.tickets.get(acceptance.ticket_id)
            if not ticket:
                continue
            acceptance.response = "expired"
            acceptance.auto_expired = True
            acceptance.responded_at = now
            tickets_by_id[ticket.id] = ticket
            self.realtime.publish_user_notification(
                ticket.hotel_id,
                acceptance.offered_to,
                {
                    "event": "ticket_escalated",
                    "ticket_id": ticket.id,
                    "reason": "acceptance_timeout",
                },
            )
            self.tickets.add_event(
                ticket,
                "acceptance_expired",
                {"offered_to": acceptance.offered_to},
                actor_id=acceptance.offered_to,
                commit=False,
            )

        fired: list[EscalationLog] = []
        for ticket in tickets_by_id.values():
            if self.acceptances.pending_for_ticket(ticket.id):
                continue
            log = self._escalate_to_next_level(ticket, "acceptance_timeout")
            if log:
                fired.append(log)

        if due or fired:
            self.db.commit()
            for log in fired:
                self.db.refresh(log)
        return fired

    def _escalate_to_next_level(self, ticket: Ticket, reason: str) -> EscalationLog | None:
        next_level = self.logs.max_level_for_ticket(ticket.id) + 1
        rule = self.rules.find_matching(
            ticket.hotel_id,
            ticket.department_id,
            ticket.type,
            ticket.task_category,
            next_level,
        )
        if not rule:
            return None

        old_assignee = ticket.assigned_to
        offers = self.dispatch_ticket(
            ticket,
            staff_level=rule.target_staff_level,
            escalation_rule=rule,
            reason=reason,
            commit=False,
        )
        log = EscalationLog(
            ticket_id=ticket.id,
            rule_id=rule.id,
            escalation_level=rule.escalation_level,
            escalated_from=old_assignee,
            escalated_to=offers[0].offered_to if offers else None,
            reason=reason,
        )
        self.db.add(log)
        self.tickets.add_event(
            ticket,
            "escalated",
            {
                "level": rule.escalation_level,
                "to": [offer.offered_to for offer in offers],
                "reason": reason,
            },
            commit=False,
        )
        self.realtime.publish_ticket_event(
            ticket.hotel_id,
            {
                "event": "ticket.escalated",
                "ticket_id": ticket.id,
                "level": rule.escalation_level,
                "reason": reason,
            },
        )
        return log

    def _find_eligible_staff(
        self,
        ticket: Ticket,
        staff_level: str | None,
        exclude_users: set[str],
    ) -> list[User]:
        if staff_level == "admin":
            candidates = [
                user
                for user in self.users.list_active_for_hotel(ticket.hotel_id)
                if user.is_hotel_owner or user.user_type == "HOTEL_ADMIN" or user.staff_level == "admin"
            ]
        elif ticket.department_id:
            candidates = list(self.users.list_for_department(ticket.hotel_id, ticket.department_id))
        else:
            candidates = list(self.users.list_active_for_hotel(ticket.hotel_id))

        if staff_level and staff_level != "admin":
            candidates = [user for user in candidates if user.staff_level == staff_level]
        candidates = [
            user
            for user in candidates
            if user.id not in exclude_users and user.is_active and user.deleted_at is None
        ]
        on_duty = [user for user in candidates if user.is_on_duty]
        if on_duty:
            candidates = on_duty
        load = defaultdict(int)
        for user in candidates:
            load[user.id] = self.tickets.count_open_for_user(ticket.hotel_id, user.id)
        return sorted(candidates, key=lambda user: (load[user.id], user.updated_at))

    def _with_preferred_staff(
        self,
        ticket: Ticket,
        staff: list[User],
        preferred_user_id: str | None,
        exclude_users: set[str],
    ) -> list[User]:
        if not preferred_user_id or preferred_user_id in exclude_users:
            return staff
        preferred = self.users.get_active(preferred_user_id)
        if not preferred or preferred.hotel_id != ticket.hotel_id:
            return staff
        remaining = [user for user in staff if user.id != preferred.id]
        return [preferred, *remaining]

    def _notify_dispatch(
        self,
        ticket: Ticket,
        user: User,
        acceptance: TicketAcceptance,
        reason: str,
    ) -> None:
        expires_at = acceptance.offered_at + timedelta(minutes=acceptance.expire_after_minutes)
        ticket_payload = self._ticket_payload(ticket)
        metadata = {
            "event": "ticket_dispatch",
            "ticket": ticket_payload,
            "ticket_id": ticket.id,
            "acceptance_id": acceptance.id,
            "expires_at": expires_at.isoformat(),
            "reason": reason,
        }
        notification = self.notifications.create(
            ticket.hotel_id,
            NotificationCreate(
                user_id=user.id,
                channel="websocket",
                title="New Ticket",
                message=f"{ticket.ticket_code}: {ticket.item_description}",
                notification_type="dispatch" if reason == "ticket_dispatch" else "escalation",
                reference_id=ticket.id,
                metadata=metadata,
            ),
            commit=False,
        )
        self.realtime.publish_user_notification(
            ticket.hotel_id,
            user.id,
            {
                "event": "ticket_dispatch",
                "ticket": ticket_payload,
                "acceptance_id": acceptance.id,
                "notification_id": notification.id,
                "expires_at": expires_at.isoformat(),
            },
        )
        self.realtime.send_fcm_to_user(
            user.id,
            "New Ticket",
            f"{ticket.ticket_code}: {ticket.item_description}",
            {"ticket_id": ticket.id, "acceptance_id": acceptance.id},
        )

    def _initial_staff_level(self, ticket: Ticket) -> str:
        rule = self.rules.find_matching(
            ticket.hotel_id,
            ticket.department_id,
            ticket.type,
            ticket.task_category,
            1,
        )
        return rule.target_staff_level if rule and rule.target_staff_level else "attendant"

    def _offer_timeout_minutes(
        self,
        ticket: Ticket,
        escalation_rule: EscalationRule | None,
    ) -> int:
        if escalation_rule and escalation_rule.trigger_after_minutes > 0:
            return escalation_rule.trigger_after_minutes
        return self.slas.get_sla_config(ticket.hotel_id, ticket.department_id, ticket.task_category).accept_timeout_minutes

    def _ticket_payload(self, ticket: Ticket) -> dict:
        return {
            "id": ticket.id,
            "hotel_id": ticket.hotel_id,
            "ticket_code": ticket.ticket_code,
            "item_description": ticket.item_description,
            "stage": ticket.stage,
            "priority": ticket.priority,
            "room_id": ticket.room_id,
            "department_id": ticket.department_id,
            "assigned_to": ticket.assigned_to,
            "source": ticket.source,
            "reservation_id": ticket.reservation_id,
            "conversation_id": ticket.conversation_id,
            "created_at": ticket.created_at.isoformat() if ticket.created_at else None,
        }

    def _get_ticket(self, hotel_id: str, ticket_id: str) -> Ticket:
        ticket = self.tickets.get_for_hotel(hotel_id, ticket_id)
        if not ticket:
            raise not_found("Ticket not found")
        return ticket

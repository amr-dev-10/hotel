from collections.abc import Sequence

from sqlalchemy import false, func, or_, select
from sqlalchemy.orm import Session

from app.models.escalation import EscalationLog, EscalationRule
from app.models.ticket import Ticket
from app.repositories.base import BaseRepository


class EscalationRuleRepository(BaseRepository[EscalationRule]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, EscalationRule)

    def list_active(self, hotel_id: str) -> Sequence[EscalationRule]:
        return self.db.execute(
            select(EscalationRule)
            .where(EscalationRule.hotel_id == hotel_id, EscalationRule.is_active.is_(True))
            .order_by(EscalationRule.escalation_level)
        ).scalars().all()

    def find_matching(
        self,
        hotel_id: str,
        department_id: str | None,
        ticket_type: str | None,
        task_category: str | None,
        task_category_id: str | None,
        escalation_level: int,
    ) -> EscalationRule | None:
        candidates = self.db.execute(
            select(EscalationRule).where(
                EscalationRule.hotel_id == hotel_id,
                EscalationRule.escalation_level == escalation_level,
                EscalationRule.is_active.is_(True),
            )
        ).scalars().all()
        matches: list[tuple[int, EscalationRule]] = []
        for rule in candidates:
            score = 0
            if rule.department_id:
                if rule.department_id != department_id:
                    continue
                score += 4
            if rule.ticket_type:
                if rule.ticket_type.lower() != (ticket_type or "").lower():
                    continue
                score += 2
            if rule.task_category:
                if rule.task_category != task_category:
                    continue
                score += 1
            if rule.task_category_id:
                if rule.task_category_id != task_category_id:
                    continue
                score += 3
            matches.append((score, rule))
        if not matches:
            return None
        matches.sort(key=lambda item: item[0], reverse=True)
        return matches[0][1]


class EscalationLogRepository(BaseRepository[EscalationLog]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, EscalationLog)

    def list_for_ticket(self, ticket_id: str) -> Sequence[EscalationLog]:
        return self.db.execute(
            select(EscalationLog)
            .where(EscalationLog.ticket_id == ticket_id)
            .order_by(EscalationLog.created_at)
        ).scalars().all()

    def list_for_hotel(
        self,
        hotel_id: str,
        user_id: str | None = None,
        department_id: str | None = None,
        include_all: bool = False,
        limit: int = 100,
    ) -> Sequence[tuple[EscalationLog, Ticket]]:
        statement = (
            select(EscalationLog, Ticket)
            .join(Ticket, Ticket.id == EscalationLog.ticket_id)
            .where(
                Ticket.hotel_id == hotel_id,
                Ticket.deleted_at.is_(None),
            )
        )
        if not include_all:
            visibility = []
            if user_id:
                visibility.extend(
                    [
                        EscalationLog.escalated_to == user_id,
                        EscalationLog.escalated_from == user_id,
                        Ticket.assigned_to == user_id,
                    ]
                )
            if department_id:
                visibility.append(Ticket.department_id == department_id)
            if visibility:
                statement = statement.where(or_(*visibility))
            else:
                statement = statement.where(false())
        return self.db.execute(statement.order_by(EscalationLog.created_at.desc()).limit(limit)).all()

    def max_level_for_ticket(self, ticket_id: str) -> int:
        return int(
            self.db.execute(
                select(func.max(EscalationLog.escalation_level)).where(
                    EscalationLog.ticket_id == ticket_id
                )
            ).scalar()
            or 0
        )

from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.escalation import EscalationLog, EscalationRule
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

    def max_level_for_ticket(self, ticket_id: str) -> int:
        return int(
            self.db.execute(
                select(func.max(EscalationLog.escalation_level)).where(
                    EscalationLog.ticket_id == ticket_id
                )
            ).scalar()
            or 0
        )

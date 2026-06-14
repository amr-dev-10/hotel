from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ticket_acceptance import TicketAcceptance
from app.repositories.base import BaseRepository


class TicketAcceptanceRepository(BaseRepository[TicketAcceptance]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, TicketAcceptance)

    def list_for_ticket(self, ticket_id: str) -> Sequence[TicketAcceptance]:
        return self.db.execute(
            select(TicketAcceptance)
            .where(TicketAcceptance.ticket_id == ticket_id)
            .order_by(TicketAcceptance.offered_at)
        ).scalars().all()

    def current_pending(self, ticket_id: str, user_id: str | None = None) -> TicketAcceptance | None:
        statement = select(TicketAcceptance).where(
            TicketAcceptance.ticket_id == ticket_id,
            TicketAcceptance.response == "pending",
        )
        if user_id:
            statement = statement.where(TicketAcceptance.offered_to == user_id)
        return self.db.execute(statement.order_by(TicketAcceptance.offered_at.desc())).scalars().first()

    def update_response(
        self,
        ticket_id: str,
        user_id: str,
        response: str,
        responded_at: datetime,
        auto_expired: bool = False,
    ) -> TicketAcceptance | None:
        acceptance = self.current_pending(ticket_id, user_id)
        if not acceptance:
            return None
        acceptance.response = response
        acceptance.responded_at = responded_at
        acceptance.auto_expired = auto_expired
        return acceptance

    def declined_user_ids(self, ticket_id: str) -> list[str]:
        rows = self.db.execute(
            select(TicketAcceptance.offered_to).where(
                TicketAcceptance.ticket_id == ticket_id,
                TicketAcceptance.response.in_(("rejected", "expired")),
            )
        ).scalars().all()
        return list(rows)

    def pending_due(self, now: datetime) -> Sequence[TicketAcceptance]:
        rows = self.db.execute(
            select(TicketAcceptance).where(TicketAcceptance.response == "pending")
        ).scalars().all()
        return [
            row
            for row in rows
            if (now - row.offered_at).total_seconds() >= row.expire_after_minutes * 60
        ]

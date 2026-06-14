from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.ticket import Ticket, TicketEvent
from app.repositories.base import BaseRepository


class TicketRepository(BaseRepository[Ticket]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Ticket)

    def list_open_for_guest(self, hotel_id: str, guest_id: str) -> Sequence[Ticket]:
        return self.db.execute(
            select(Ticket).where(
                Ticket.hotel_id == hotel_id,
                Ticket.guest_id == guest_id,
                Ticket.stage.not_in(("Completed", "Cancelled")),
                Ticket.deleted_at.is_(None),
            )
        ).scalars().all()

    def count_open_for_user(self, hotel_id: str, user_id: str) -> int:
        return self.db.execute(
            select(func.count()).select_from(Ticket).where(
                Ticket.hotel_id == hotel_id,
                Ticket.assigned_to == user_id,
                Ticket.stage.not_in(("Completed", "Cancelled", "closed", "resolved")),
                Ticket.deleted_at.is_(None),
            )
        ).scalar_one()

    def add_event(
        self,
        ticket: Ticket,
        event_type: str,
        payload: dict,
        actor_id: str | None = None,
        commit: bool = False,
    ) -> TicketEvent:
        event = TicketEvent(
            hotel_id=ticket.hotel_id,
            ticket_id=ticket.id,
            actor_id=actor_id,
            event_type=event_type,
            payload=payload,
            created_at=utcnow(),
        )
        self.db.add(event)
        if commit:
            self.db.commit()
            self.db.refresh(event)
        return event

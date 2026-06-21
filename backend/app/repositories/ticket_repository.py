from collections.abc import Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.department import Department
from app.models.ticket import Ticket, TicketEvent, TicketMessage
from app.repositories.base import BaseRepository
from app.repositories.pagination import CursorResult, apply_created_at_cursor, paginate_created_at_desc


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

    def list_filtered(
        self,
        hotel_id: str,
        guest_id: str | None = None,
        reservation_id: str | None = None,
        conversation_id: str | None = None,
        stage: str | None = None,
        priority: int | None = None,
        assigned_to: str | None = None,
        department_key: str | None = None,
        sla_status: str | None = None,
        q: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> CursorResult[Ticket]:
        statement = select(Ticket).where(
            Ticket.hotel_id == hotel_id,
            Ticket.deleted_at.is_(None),
        )
        if guest_id:
            statement = statement.where(Ticket.guest_id == guest_id)
        if reservation_id:
            statement = statement.where(Ticket.reservation_id == reservation_id)
        if conversation_id:
            statement = statement.where(Ticket.conversation_id == conversation_id)
        if stage:
            stage_aliases = {
                "created": ("created", "Open"),
                "accepted": ("accepted", "reopened"),
                "approved": ("approved", "Completed"),
            }
            statement = statement.where(Ticket.stage.in_(stage_aliases.get(stage, (stage,))))
        if priority:
            statement = statement.where(Ticket.priority == priority)
        if assigned_to == "unassigned":
            statement = statement.where(Ticket.assigned_to.is_(None))
        elif assigned_to:
            statement = statement.where(Ticket.assigned_to == assigned_to)
        if department_key:
            statement = statement.join(Department, Ticket.department_id == Department.id).where(
                Department.hotel_id == hotel_id,
                Department.key == department_key,
                Department.deleted_at.is_(None),
            )
        if sla_status == "breached":
            statement = statement.where(
                Ticket.sla_due_at.is_not(None),
                Ticket.sla_due_at < utcnow(),
                Ticket.stage.not_in(("approved", "Completed", "Cancelled", "closed", "resolved")),
            )
        if q:
            pattern = f"%{q.strip()}%"
            statement = statement.where(
                or_(
                    Ticket.ticket_code.ilike(pattern),
                    Ticket.item_description.ilike(pattern),
                    Ticket.stage.ilike(pattern),
                    Ticket.room_id.ilike(pattern),
                    Ticket.assigned_to.ilike(pattern),
                    Ticket.source.ilike(pattern),
                )
            )
        statement = apply_created_at_cursor(statement, Ticket, cursor)
        rows = (
            self.db.execute(
                statement.order_by(Ticket.created_at.desc(), Ticket.id.desc()).limit(limit + 1)
            )
            .scalars()
            .all()
        )
        return paginate_created_at_desc(rows, limit)

    def list_unresolved(self, hotel_id: str | None = None) -> Sequence[Ticket]:
        terminal = (
            "Completed",
            "Cancelled",
            "approved",
            "cancelled",
            "closed",
            "resolved",
        )
        statement = select(Ticket).where(
            Ticket.stage.not_in(terminal),
            Ticket.deleted_at.is_(None),
        )
        if hotel_id:
            statement = statement.where(Ticket.hotel_id == hotel_id)
        return self.db.execute(statement.order_by(Ticket.created_at)).scalars().all()

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


class TicketMessageRepository(BaseRepository[TicketMessage]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, TicketMessage)

    def list_for_ticket(self, hotel_id: str, ticket_id: str) -> Sequence[TicketMessage]:
        return self.db.execute(
            select(TicketMessage)
            .where(
                TicketMessage.hotel_id == hotel_id,
                TicketMessage.ticket_id == ticket_id,
            )
            .order_by(TicketMessage.created_at)
        ).scalars().all()

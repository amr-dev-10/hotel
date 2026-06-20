from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.escalation_repository import EscalationLogRepository
from app.repositories.ticket_acceptance_repository import TicketAcceptanceRepository
from app.repositories.ticket_repository import TicketRepository
from app.schemas.ticket import (
    TicketAcceptanceRead,
    TicketCreate,
    TicketMessageCreate,
    TicketMessageRead,
    TicketRead,
    TicketStageUpdate,
)
from app.schemas.v51 import EscalationLogRead
from app.services.ticket_service import TicketService

router = APIRouter()


@router.get("")
def list_tickets(
    hotel_id: str,
    guest_id: str | None = None,
    reservation_id: str | None = None,
    conversation_id: str | None = None,
    stage: str | None = None,
    priority: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    tickets = TicketRepository(db).list_filtered(
        hotel_id,
        guest_id=guest_id,
        reservation_id=reservation_id,
        conversation_id=conversation_id,
        stage=stage,
        priority=priority,
    )
    return ok([TicketRead.model_validate(item).model_dump() for item in tickets])


@router.post("")
def create_ticket(
    hotel_id: str,
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    ticket = TicketService(db).create_ticket(hotel_id, payload, actor_id=current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.get("/{ticket_id}/messages")
def list_ticket_messages(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    messages = TicketService(db).list_messages(hotel_id, ticket_id)
    return ok([TicketMessageRead.model_validate(item).model_dump() for item in messages])


@router.post("/{ticket_id}/messages")
def create_ticket_message(
    hotel_id: str,
    ticket_id: str,
    payload: TicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    message = TicketService(db).create_message(hotel_id, ticket_id, payload, current_user.id)
    return ok(TicketMessageRead.model_validate(message).model_dump())


@router.get("/{ticket_id}/timeline")
def get_ticket_timeline(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    items = TicketService(db).timeline(hotel_id, ticket_id)
    return ok([item.model_dump() for item in items])


@router.patch("/{ticket_id}/stage")
def update_ticket_stage(
    hotel_id: str,
    ticket_id: str,
    payload: TicketStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.close")),
) -> dict:
    ticket = TicketService(db).update_stage(
        hotel_id,
        ticket_id,
        payload.stage,
        note=payload.note,
        actor_id=current_user.id,
        actor=current_user,
    )
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/accept")
def accept_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketService(db).accept_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/reject")
def reject_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketService(db).reject_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/complete")
def complete_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketService(db).complete_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/approve")
def approve_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.approve")),
) -> dict:
    ticket = TicketService(db).approve_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/reopen")
def reopen_ticket(
    hotel_id: str,
    ticket_id: str,
    payload: TicketStageUpdate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.approve")),
) -> dict:
    ticket = TicketService(db).reopen_ticket(
        hotel_id,
        ticket_id,
        current_user.id,
        note=payload.note if payload else None,
    )
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.get("/{ticket_id}/acceptances")
def list_ticket_acceptances(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketRepository(db).get_for_hotel(hotel_id, ticket_id)
    if not ticket:
        from app.core.exceptions import not_found

        raise not_found("Ticket not found")
    rows = TicketAcceptanceRepository(db).list_for_ticket(ticket_id)
    return ok([TicketAcceptanceRead.model_validate(item).model_dump() for item in rows])


@router.get("/{ticket_id}/escalations")
def list_ticket_escalations(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketRepository(db).get_for_hotel(hotel_id, ticket_id)
    if not ticket:
        from app.core.exceptions import not_found

        raise not_found("Ticket not found")
    rows = EscalationLogRepository(db).list_for_ticket(ticket_id)
    return ok([EscalationLogRead.model_validate(item).model_dump() for item in rows])

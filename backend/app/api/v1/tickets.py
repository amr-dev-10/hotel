from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.exceptions import bad_request, not_found
from app.core.responses import ok
from app.models.guest import Guest
from app.models.reservation import Reservation
from app.models.room import Room
from app.models.ticket import Ticket
from app.models.user import User
from app.repositories.escalation_repository import EscalationLogRepository
from app.repositories.ticket_acceptance_repository import TicketAcceptanceRepository
from app.repositories.ticket_repository import TicketRepository
from app.repositories.whatsapp_repository import WhatsAppConversationRepository
from app.schemas.ticket import (
    TicketAcceptanceRead,
    TicketCreate,
    EscalatedTicketRead,
    TicketMessageCreate,
    TicketMessageRead,
    TicketRejectRequest,
    TicketRead,
    TicketStageUpdate,
    TicketUpdate,
)
from app.schemas.v51 import EscalationLogRead
from app.schemas.whatsapp_account import WhatsAppMessageRead
from app.services.ticket_service import TicketService

router = APIRouter()


@router.get("")
def list_tickets(
    hotel_id: str,
    q: str | None = None,
    guest_id: str | None = None,
    reservation_id: str | None = None,
    conversation_id: str | None = None,
    stage: str | None = None,
    priority: int | None = None,
    assigned_to: str | None = None,
    department_key: str | None = None,
    sla_status: str | None = None,
    cursor: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    try:
        page = TicketRepository(db).list_filtered(
            hotel_id,
            guest_id=guest_id,
            reservation_id=reservation_id,
            conversation_id=conversation_id,
            stage=stage,
            priority=priority,
            assigned_to=assigned_to,
            department_key=department_key,
            sla_status=sla_status,
            q=q,
            cursor=cursor,
            limit=limit,
        )
    except ValueError:
        raise bad_request("Invalid pagination cursor") from None
    ticket_context = _ticket_context(db, hotel_id, list(page.items))
    return ok(
        [_ticket_read(item, ticket_context).model_dump() for item in page.items],
        meta={"next_cursor": page.next_cursor, "has_more": page.has_more, "limit": page.limit},
    )


@router.post("")
def create_ticket(
    hotel_id: str,
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.create")),
) -> dict:
    ticket = TicketService(db).create_ticket(hotel_id, payload, actor_id=current_user.id)
    return ok(_ticket_read(ticket, _ticket_context(db, hotel_id, [ticket])).model_dump())


@router.get("/escalations")
def list_escalated_tickets(
    hotel_id: str,
    scope: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    include_all = bool(
        scope == "all"
        and (
            current_user.is_hotel_owner
            or current_user.user_type == "HOTEL_ADMIN"
            or current_user.staff_level == "admin"
        )
    )
    if scope is None:
        include_all = bool(
            current_user.is_hotel_owner
            or current_user.user_type == "HOTEL_ADMIN"
            or current_user.staff_level == "admin"
        )
    rows = list(
        EscalationLogRepository(db).list_for_hotel(
            hotel_id,
            user_id=current_user.id,
            department_id=None if scope == "mine" else current_user.department_id,
            include_all=include_all,
        )
    )
    pending_rows = list(
        TicketAcceptanceRepository(db).list_pending_for_hotel(
            hotel_id,
            user_id=current_user.id,
            department_id=None if scope == "mine" else current_user.department_id,
            include_all=include_all,
        )
    )
    logged_ticket_ids = {ticket.id for _, ticket in rows}
    pending_rows = [(acceptance, ticket) for acceptance, ticket in pending_rows if ticket.id not in logged_ticket_ids]
    ticket_context = _ticket_context(
        db,
        hotel_id,
        [ticket for _, ticket in rows] + [ticket for _, ticket in pending_rows],
    )
    user_names = _user_names(
        db,
        hotel_id,
        [log.escalated_from for log, _ in rows]
        + [log.escalated_to for log, _ in rows]
        + [acceptance.offered_to for acceptance, _ in pending_rows],
    )
    items = [
        EscalatedTicketRead(
            escalation_id=log.id,
            ticket_id=log.ticket_id,
            rule_id=log.rule_id,
            escalation_level=log.escalation_level,
            escalated_from=log.escalated_from,
            escalated_from_name=user_names.get(log.escalated_from or ""),
            escalated_to=log.escalated_to,
            escalated_to_name=user_names.get(log.escalated_to or ""),
            reason=log.reason,
            notes=log.notes,
            escalated_at=log.created_at,
            ticket=_ticket_read(ticket, ticket_context),
        ).model_dump()
        for log, ticket in rows
    ]
    items.extend(
        EscalatedTicketRead(
            escalation_id=f"acceptance:{acceptance.id}",
            ticket_id=ticket.id,
            rule_id=acceptance.id,
            escalation_level=0,
            escalated_from=None,
            escalated_from_name=None,
            escalated_to=acceptance.offered_to,
            escalated_to_name=user_names.get(acceptance.offered_to),
            reason="pending_acceptance",
            notes=None,
            escalated_at=acceptance.offered_at,
            ticket=_ticket_read(ticket, ticket_context),
        ).model_dump()
        for acceptance, ticket in pending_rows
    )
    return ok(items)


@router.get("/{ticket_id}")
def get_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketRepository(db).get_for_hotel(hotel_id, ticket_id)
    if not ticket:
        raise not_found("Ticket not found")
    return ok(_ticket_read(ticket, _ticket_context(db, hotel_id, [ticket])).model_dump())


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


@router.get("/{ticket_id}/guest-messages")
def list_ticket_guest_messages(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketRepository(db).get_for_hotel(hotel_id, ticket_id)
    if not ticket:
        raise not_found("Ticket not found")
    messages = WhatsAppConversationRepository(db).list_ticket_messages(hotel_id, ticket_id)
    return ok([WhatsAppMessageRead.model_validate(item).model_dump() for item in messages])


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


@router.patch("/{ticket_id}")
def update_ticket(
    hotel_id: str,
    ticket_id: str,
    payload: TicketUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.assign")),
) -> dict:
    ticket = TicketService(db).update_ticket(hotel_id, ticket_id, payload, actor_id=current_user.id)
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
    payload: TicketRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    ticket = TicketService(db).reject_ticket(
        hotel_id,
        ticket_id,
        current_user.id,
        reason=payload.reason if payload else None,
    )
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


def _ticket_read(ticket: Ticket, ticket_context: dict[str, dict[str, str | None]]) -> TicketRead:
    return TicketRead.model_validate(ticket).model_copy(update=ticket_context.get(ticket.id, {}))


def _ticket_context(db: Session, hotel_id: str, tickets: list[Ticket]) -> dict[str, dict[str, str | None]]:
    if not tickets:
        return {}

    user_names = _user_names(db, hotel_id, [ticket.assigned_to for ticket in tickets])
    room_numbers = _room_numbers(db, hotel_id, [ticket.room_id for ticket in tickets])
    guest_names = _guest_names(db, hotel_id, [ticket.guest_id for ticket in tickets])
    reservation_numbers = _reservation_numbers(db, hotel_id, [ticket.reservation_id for ticket in tickets])

    return {
        ticket.id: {
            "assigned_to_name": user_names.get(ticket.assigned_to or ""),
            "room_number": room_numbers.get(ticket.room_id or ""),
            "guest_name": guest_names.get(ticket.guest_id or ""),
            "reservation_no": reservation_numbers.get(ticket.reservation_id or ""),
        }
        for ticket in tickets
    }


def _user_names(db: Session, hotel_id: str, user_ids: list[str | None]) -> dict[str, str]:
    ids = {user_id for user_id in user_ids if user_id}
    if not ids:
        return {}
    rows = db.execute(
        select(User.id, User.name).where(
            User.hotel_id == hotel_id,
            User.id.in_(ids),
            User.deleted_at.is_(None),
        )
    ).all()
    return {user_id: name for user_id, name in rows}


def _room_numbers(db: Session, hotel_id: str, room_ids: list[str | None]) -> dict[str, str]:
    ids = {room_id for room_id in room_ids if room_id}
    if not ids:
        return {}
    rows = db.execute(
        select(Room.id, Room.room_number).where(
            Room.hotel_id == hotel_id,
            Room.id.in_(ids),
            Room.deleted_at.is_(None),
        )
    ).all()
    return {room_id: room_number for room_id, room_number in rows}


def _guest_names(db: Session, hotel_id: str, guest_ids: list[str | None]) -> dict[str, str]:
    ids = {guest_id for guest_id in guest_ids if guest_id}
    if not ids:
        return {}
    rows = db.execute(
        select(Guest.id, Guest.name).where(
            Guest.hotel_id == hotel_id,
            Guest.id.in_(ids),
            Guest.deleted_at.is_(None),
        )
    ).all()
    return {guest_id: name for guest_id, name in rows}


def _reservation_numbers(db: Session, hotel_id: str, reservation_ids: list[str | None]) -> dict[str, str]:
    ids = {reservation_id for reservation_id in reservation_ids if reservation_id}
    if not ids:
        return {}
    rows = db.execute(
        select(Reservation.id, Reservation.reservation_no).where(
            Reservation.hotel_id == hotel_id,
            Reservation.id.in_(ids),
            Reservation.deleted_at.is_(None),
        )
    ).all()
    return {reservation_id: reservation_no for reservation_id, reservation_no in rows}

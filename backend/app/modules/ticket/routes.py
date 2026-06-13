from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.middleware.permissions import require_permission
from app.modules.hotel.dependencies import ensure_hotel_scope
from app.modules.ticket.models import Ticket, TicketAssignment, TicketHistory, TicketMessage, TicketStatus
from app.modules.ticket.schemas import (
    HotelTicketCreate,
    HotelTicketMessageCreate,
    HotelTicketMessageRead,
    HotelTicketRead,
    HotelTicketUpdate,
    TicketAssignRequest,
    TicketCreate,
    TicketHistoryRead,
    TicketMessageCreate,
    TicketRead,
    TicketUpdate,
)

router = APIRouter(prefix="/tickets", tags=["tickets"])
hotel_router = APIRouter(prefix="/hotels/{hotel_id}/tickets", tags=["hotel tickets"])


@router.get("", response_model=list[TicketRead])
def list_tickets(
    context: TenantContext = Depends(require_permission("ticket.view")),
    db: Session = Depends(get_db),
) -> list[Ticket]:
    return list(db.scalars(select(Ticket).where(Ticket.tenant_id == str(context.tenant_id))).all())


@router.post("", response_model=TicketRead, status_code=201)
def create_ticket(
    payload: TicketCreate,
    context: TenantContext = Depends(require_permission("ticket.create")),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = Ticket(tenant_id=str(context.tenant_id), created_by=str(context.user_id), **payload.model_dump())
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.patch("/{ticket_id}", response_model=TicketRead)
def update_ticket(
    ticket_id: str,
    payload: TicketUpdate,
    context: TenantContext = Depends(require_permission("ticket.update")),
    db: Session = Depends(get_db),
) -> Ticket:
    ticket = db.scalar(select(Ticket).where(Ticket.id == ticket_id, Ticket.tenant_id == str(context.tenant_id)))
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(ticket, key, value)
    db.commit()
    db.refresh(ticket)
    return ticket


@router.post("/{ticket_id}/messages", status_code=201)
def add_message(
    ticket_id: str,
    payload: TicketMessageCreate,
    context: TenantContext = Depends(require_permission("ticket.comment")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    ticket = db.scalar(select(Ticket).where(Ticket.id == ticket_id, Ticket.tenant_id == str(context.tenant_id)))
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    message = TicketMessage(
        tenant_id=str(context.tenant_id),
        ticket_id=ticket_id,
        sender_id=str(context.user_id),
        message=payload.message,
    )
    db.add(message)
    db.commit()
    return {"id": message.id}


def _ticket_to_read(ticket: Ticket) -> HotelTicketRead:
    return HotelTicketRead(
        id=ticket.id,
        hotel_id=ticket.tenant_id,
        ticket_code=ticket.ticket_code,
        guest_id=ticket.guest_id,
        room_id=ticket.room_id,
        department_id=ticket.department_id,
        assigned_to=ticket.assigned_to,
        stage=ticket.stage,
        type=ticket.type,
        item_description=ticket.item_description,
        source=ticket.source,
        priority=ticket.priority,
    )


def _history_to_read(history: TicketHistory) -> TicketHistoryRead:
    return TicketHistoryRead(
        id=history.id,
        hotel_id=history.tenant_id,
        ticket_id=history.ticket_id,
        from_stage=history.from_stage,
        to_stage=history.to_stage,
        changed_by=history.changed_by,
        changed_at=history.changed_at,
    )


def _message_to_read(message: TicketMessage) -> HotelTicketMessageRead:
    return HotelTicketMessageRead(
        id=message.id,
        hotel_id=message.tenant_id,
        ticket_id=message.ticket_id,
        sender_type=message.sender_type,
        sender_id=message.sender_id,
        content=message.content or message.message,
    )


def _get_hotel_ticket(db: Session, hotel_id: str, ticket_id: str) -> Ticket:
    ticket = db.scalar(select(Ticket).where(Ticket.tenant_id == hotel_id, Ticket.id == ticket_id))
    if ticket is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    return ticket


def _next_ticket_code(db: Session, hotel_id: str) -> str:
    count = db.scalar(select(func.count()).select_from(Ticket).where(Ticket.tenant_id == hotel_id)) or 0
    return f"TCK-{count + 1:06d}"


def _status_from_stage(stage: str) -> TicketStatus:
    try:
        return TicketStatus(stage)
    except ValueError:
        return TicketStatus.created


def _record_history(db: Session, hotel_id: str, ticket_id: str, from_stage: str | None, to_stage: str, user_id: str) -> None:
    db.add(
        TicketHistory(
            tenant_id=hotel_id,
            ticket_id=ticket_id,
            from_stage=from_stage,
            to_stage=to_stage,
            changed_by=user_id,
            changed_at=datetime.now(timezone.utc).isoformat(),
        )
    )


@hotel_router.get("", response_model=list[HotelTicketRead])
def list_hotel_tickets(
    hotel_id: str,
    stage: str | None = None,
    department_id: str | None = None,
    assigned_to: str | None = None,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[HotelTicketRead]:
    ensure_hotel_scope(hotel_id, context)
    statement = select(Ticket).where(Ticket.tenant_id == hotel_id)
    if stage is not None:
        statement = statement.where(Ticket.stage == stage)
    if department_id is not None:
        statement = statement.where(Ticket.department_id == department_id)
    if assigned_to is not None:
        statement = statement.where(Ticket.assigned_to == assigned_to)
    tickets = db.scalars(statement.order_by(Ticket.created_at.desc())).all()
    return [_ticket_to_read(ticket) for ticket in tickets]


@hotel_router.post("", response_model=HotelTicketRead, status_code=201)
def create_hotel_ticket(
    hotel_id: str,
    payload: HotelTicketCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> HotelTicketRead:
    ensure_hotel_scope(hotel_id, context)
    ticket = Ticket(
        tenant_id=hotel_id,
        workflow_id="guest-service",
        ticket_code=_next_ticket_code(db, hotel_id),
        guest_id=payload.guest_id,
        room_id=payload.room_id,
        department_id=payload.department_id,
        assigned_to=payload.assigned_to,
        title=payload.item_description[:180],
        description=payload.item_description,
        priority=payload.priority,
        status=_status_from_stage(payload.stage),
        stage=payload.stage,
        type=payload.type,
        item_description=payload.item_description,
        source=payload.source,
        created_by=str(context.user_id),
    )
    db.add(ticket)
    db.flush()
    _record_history(db, hotel_id, ticket.id, None, payload.stage, str(context.user_id))
    db.commit()
    db.refresh(ticket)
    return _ticket_to_read(ticket)


@hotel_router.get("/{ticket_id}", response_model=HotelTicketRead)
def get_hotel_ticket(
    hotel_id: str,
    ticket_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> HotelTicketRead:
    ensure_hotel_scope(hotel_id, context)
    return _ticket_to_read(_get_hotel_ticket(db, hotel_id, ticket_id))


@hotel_router.put("/{ticket_id}", response_model=HotelTicketRead)
def update_hotel_ticket(
    hotel_id: str,
    ticket_id: str,
    payload: HotelTicketUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> HotelTicketRead:
    ensure_hotel_scope(hotel_id, context)
    ticket = _get_hotel_ticket(db, hotel_id, ticket_id)
    updates = payload.model_dump(exclude_unset=True)
    old_stage = ticket.stage
    for key, value in updates.items():
        setattr(ticket, key, value)
    if "item_description" in updates and updates["item_description"]:
        ticket.title = updates["item_description"][:180]
        ticket.description = updates["item_description"]
    if "stage" in updates and updates["stage"] != old_stage:
        ticket.status = _status_from_stage(updates["stage"])
        _record_history(db, hotel_id, ticket.id, old_stage, updates["stage"], str(context.user_id))
    db.commit()
    db.refresh(ticket)
    return _ticket_to_read(ticket)


@hotel_router.delete("/{ticket_id}", status_code=204)
def cancel_hotel_ticket(
    hotel_id: str,
    ticket_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Response:
    ensure_hotel_scope(hotel_id, context)
    ticket = _get_hotel_ticket(db, hotel_id, ticket_id)
    old_stage = ticket.stage
    ticket.stage = "cancelled"
    ticket.status = TicketStatus.closed
    _record_history(db, hotel_id, ticket.id, old_stage, "cancelled", str(context.user_id))
    db.commit()
    return Response(status_code=204)


@hotel_router.get("/{ticket_id}/history", response_model=list[TicketHistoryRead])
def ticket_history(
    hotel_id: str,
    ticket_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[TicketHistoryRead]:
    ensure_hotel_scope(hotel_id, context)
    _get_hotel_ticket(db, hotel_id, ticket_id)
    rows = db.scalars(
        select(TicketHistory).where(TicketHistory.tenant_id == hotel_id, TicketHistory.ticket_id == ticket_id)
    ).all()
    return [_history_to_read(row) for row in rows]


@hotel_router.post("/{ticket_id}/assign", response_model=HotelTicketRead)
def assign_ticket(
    hotel_id: str,
    ticket_id: str,
    payload: TicketAssignRequest,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> HotelTicketRead:
    ensure_hotel_scope(hotel_id, context)
    ticket = _get_hotel_ticket(db, hotel_id, ticket_id)
    old_stage = ticket.stage
    ticket.assigned_to = payload.assigned_to
    ticket.stage = "assigned"
    ticket.status = TicketStatus.assigned
    db.add(
        TicketAssignment(
            tenant_id=hotel_id,
            ticket_id=ticket_id,
            assigned_to=payload.assigned_to,
            assigned_by=str(context.user_id),
        )
    )
    if old_stage != "assigned":
        _record_history(db, hotel_id, ticket.id, old_stage, "assigned", str(context.user_id))
    db.commit()
    db.refresh(ticket)
    return _ticket_to_read(ticket)


@hotel_router.get("/{ticket_id}/messages", response_model=list[HotelTicketMessageRead])
def list_ticket_messages(
    hotel_id: str,
    ticket_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[HotelTicketMessageRead]:
    ensure_hotel_scope(hotel_id, context)
    _get_hotel_ticket(db, hotel_id, ticket_id)
    messages = db.scalars(
        select(TicketMessage)
        .where(TicketMessage.tenant_id == hotel_id, TicketMessage.ticket_id == ticket_id)
        .order_by(TicketMessage.created_at)
    ).all()
    return [_message_to_read(message) for message in messages]


@hotel_router.post("/{ticket_id}/messages", response_model=HotelTicketMessageRead, status_code=201)
def send_ticket_message(
    hotel_id: str,
    ticket_id: str,
    payload: HotelTicketMessageCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> HotelTicketMessageRead:
    ensure_hotel_scope(hotel_id, context)
    _get_hotel_ticket(db, hotel_id, ticket_id)
    message = TicketMessage(
        tenant_id=hotel_id,
        ticket_id=ticket_id,
        sender_type=payload.sender_type,
        sender_id=str(context.user_id),
        content=payload.content,
        message=payload.content,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return _message_to_read(message)

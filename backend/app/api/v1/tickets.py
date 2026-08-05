from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.permissions import Permissions
from app.core.database import get_db
from app.core.exceptions import bad_request, forbidden, missing_permission, not_found
from app.core.responses import ok
from app.models.base import utcnow
from app.models.department import Department
from app.models.guest import Guest
from app.models.reservation import Reservation
from app.models.room import Room
from app.models.ticket import Ticket
from app.models.ticket_category import TicketCategory
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
from app.services.audit_service import AuditService
from app.services.rbac_service import RBACService
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
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    rbac = RBACService(db)
    visibility_scope = rbac.ticket_visibility_scope(current_user)
    try:
        repo = TicketRepository(db)
        page = repo.list_filtered(
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
            visibility_scope=visibility_scope,
            visibility_user_id=current_user.id,
            visibility_department_id=current_user.department_id,
            cursor=cursor,
            limit=limit,
        )
        total = repo.count_filtered(
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
            visibility_scope=visibility_scope,
            visibility_user_id=current_user.id,
            visibility_department_id=current_user.department_id,
        )
    except ValueError:
        raise bad_request("Invalid pagination cursor") from None
    ticket_context = _ticket_context(db, hotel_id, list(page.items))
    return ok(
        [_ticket_read(item, ticket_context).model_dump() for item in page.items],
        meta={"next_cursor": page.next_cursor, "has_more": page.has_more, "limit": page.limit, "total": total},
    )


@router.post("")
def create_ticket(
    hotel_id: str,
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_CREATE)),
) -> dict:
    _ensure_ticket_create_assignment_allowed(db, current_user, payload)
    ticket = TicketService(db).create_ticket(hotel_id, payload, actor_id=current_user.id)
    return ok(_ticket_read(ticket, _ticket_context(db, hotel_id, [ticket])).model_dump())


@router.get("/escalations")
def list_escalated_tickets(
    hotel_id: str,
    scope: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    visibility_scope = RBACService(db).ticket_visibility_scope(current_user)
    include_all = bool(scope == "all" and visibility_scope == "all")
    if scope is None:
        include_all = visibility_scope == "all"
    department_id = None
    if visibility_scope == "department" and scope != "mine":
        department_id = current_user.department_id
    rows = list(
        EscalationLogRepository(db).list_for_hotel(
            hotel_id,
            user_id=current_user.id,
            department_id=department_id,
            include_all=include_all,
        )
    )
    pending_rows = list(
        TicketAcceptanceRepository(db).list_pending_for_hotel(
            hotel_id,
            user_id=current_user.id,
            department_id=department_id,
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
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    ticket = TicketRepository(db).get_for_hotel(hotel_id, ticket_id)
    if not ticket:
        raise not_found("Ticket not found")
    _ensure_ticket_visible(db, current_user, ticket)
    return ok(_ticket_read(ticket, _ticket_context(db, hotel_id, [ticket])).model_dump())


@router.get("/{ticket_id}/messages")
def list_ticket_messages(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    messages = TicketService(db).list_messages(hotel_id, ticket_id)
    return ok([TicketMessageRead.model_validate(item).model_dump() for item in messages])


@router.post("/{ticket_id}/messages")
def create_ticket_message(
    hotel_id: str,
    ticket_id: str,
    payload: TicketMessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    message = TicketService(db).create_message(hotel_id, ticket_id, payload, current_user.id)
    return ok(TicketMessageRead.model_validate(message).model_dump())


@router.get("/{ticket_id}/timeline")
def get_ticket_timeline(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    items = TicketService(db).timeline(hotel_id, ticket_id)
    return ok([item.model_dump() for item in items])


@router.get("/{ticket_id}/guest-messages")
def list_ticket_guest_messages(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    messages = WhatsAppConversationRepository(db).list_ticket_messages(hotel_id, ticket_id)
    return ok([WhatsAppMessageRead.model_validate(item).model_dump() for item in messages])


@router.patch("/{ticket_id}/stage")
def update_ticket_stage(
    hotel_id: str,
    ticket_id: str,
    payload: TicketStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _get_updateable_ticket(db, hotel_id, ticket_id, current_user)
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
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    ticket_to_update = _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    _authorize_ticket_patch(db, current_user, ticket_to_update, payload)
    ticket = TicketService(db).update_ticket(hotel_id, ticket_id, payload, actor_id=current_user.id)
    return ok(_ticket_read(ticket, _ticket_context(db, hotel_id, [ticket])).model_dump())


@router.delete("/{ticket_id}")
def delete_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_DELETE)),
) -> dict:
    ticket = _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    _ensure_ticket_delete_allowed(db, current_user, ticket)
    AuditService(db).log(
        hotel_id,
        "ticket.deleted",
        "ticket",
        ticket.id,
        current_user.id,
        payload={"ticket_code": ticket.ticket_code, "stage": ticket.stage},
    )
    TicketRepository(db).soft_delete(ticket, utcnow(), current_user.id)
    return ok({"deleted": True, "ticket_id": ticket_id})


@router.post("/{ticket_id}/accept")
def accept_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _get_updateable_ticket(db, hotel_id, ticket_id, current_user)
    ticket = TicketService(db).accept_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/reject")
def reject_ticket(
    hotel_id: str,
    ticket_id: str,
    payload: TicketRejectRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _get_updateable_ticket(db, hotel_id, ticket_id, current_user)
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
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _get_updateable_ticket(db, hotel_id, ticket_id, current_user)
    ticket = TicketService(db).complete_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/approve")
def approve_ticket(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _get_updateable_ticket(db, hotel_id, ticket_id, current_user)
    ticket = TicketService(db).approve_ticket(hotel_id, ticket_id, current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.post("/{ticket_id}/reopen")
def reopen_ticket(
    hotel_id: str,
    ticket_id: str,
    payload: TicketStageUpdate | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_UPDATE)),
) -> dict:
    _get_updateable_ticket(db, hotel_id, ticket_id, current_user)
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
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    rows = TicketAcceptanceRepository(db).list_for_ticket(ticket_id)
    return ok([TicketAcceptanceRead.model_validate(item).model_dump() for item in rows])


@router.get("/{ticket_id}/escalations")
def list_ticket_escalations(
    hotel_id: str,
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.TICKET_VIEW)),
) -> dict:
    _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    rows = EscalationLogRepository(db).list_for_ticket(ticket_id)
    return ok([EscalationLogRead.model_validate(item).model_dump() for item in rows])


def _get_visible_ticket(db: Session, hotel_id: str, ticket_id: str, current_user: User) -> Ticket:
    ticket = TicketRepository(db).get_for_hotel(hotel_id, ticket_id)
    if not ticket:
        raise not_found("Ticket not found")
    _ensure_ticket_visible(db, current_user, ticket)
    return ticket


def _get_updateable_ticket(db: Session, hotel_id: str, ticket_id: str, current_user: User) -> Ticket:
    ticket = _get_visible_ticket(db, hotel_id, ticket_id, current_user)
    _ensure_ticket_update_allowed(db, current_user, ticket)
    return ticket


def _ensure_ticket_visible(db: Session, current_user: User, ticket: Ticket) -> None:
    if not RBACService(db).can_view_ticket(current_user, ticket):
        raise forbidden("Ticket is outside your access scope")


def _ensure_ticket_update_allowed(db: Session, current_user: User, ticket: Ticket) -> None:
    if not RBACService(db).can_update_ticket(current_user, ticket):
        raise forbidden("Ticket is outside your update scope")


def _ensure_ticket_delete_allowed(db: Session, current_user: User, ticket: Ticket) -> None:
    if not RBACService(db).can_delete_ticket(current_user, ticket):
        raise forbidden("Ticket is outside your delete scope")


def _authorize_ticket_patch(db: Session, current_user: User, ticket: Ticket, payload: TicketUpdate) -> None:
    changes = payload.model_dump(exclude_unset=True)
    if not changes:
        _ensure_ticket_update_allowed(db, current_user, ticket)
        return

    assignment_changed = "assigned_to" in changes and changes["assigned_to"] != ticket.assigned_to
    non_assignment_changes = set(changes) - {"assigned_to"}

    if non_assignment_changes:
        _ensure_ticket_update_allowed(db, current_user, ticket)
    if assignment_changed:
        _ensure_ticket_assignment_allowed(db, current_user, ticket, changes["assigned_to"])


def _ensure_ticket_assignment_allowed(
    db: Session,
    current_user: User,
    ticket: Ticket,
    assignee_id: str | None,
) -> None:
    rbac = RBACService(db)
    if assignee_id == current_user.id:
        if rbac.can_assign_ticket_to_self(current_user, ticket):
            return
    elif assignee_id and rbac.can_assign_ticket_to_others(current_user, ticket):
        return
    elif not assignee_id and rbac.can_assign_ticket_to_others(current_user, ticket):
        return
    permission = Permissions.TICKET_ASSIGN_SELF if assignee_id == current_user.id else Permissions.TICKET_ASSIGN_OTHERS
    raise missing_permission(permission, "Missing ticket assignment permission")


def _ensure_ticket_create_assignment_allowed(db: Session, current_user: User, payload: TicketCreate) -> None:
    assignee_ids = {user_id for user_id in [payload.assigned_to, *payload.followers] if user_id}
    if not assignee_ids or current_user.is_hotel_owner:
        return

    rbac = RBACService(db)
    assigns_only_self = assignee_ids == {current_user.id}
    required_permission = Permissions.TICKET_ASSIGN_SELF if assigns_only_self else Permissions.TICKET_ASSIGN_OTHERS
    if not rbac.has_permission(current_user, required_permission):
        raise missing_permission(required_permission, "Missing ticket assignment permission")

    scope = rbac.permission_scope(current_user, required_permission)
    if scope == "hotel":
        return
    if scope == "department" and payload.department_id and payload.department_id == current_user.department_id:
        return
    if scope == "own" and assigns_only_self:
        return
    raise forbidden("Ticket assignment is outside your access scope")


def _ticket_read(ticket: Ticket, ticket_context: dict[str, dict[str, str | None]]) -> TicketRead:
    return TicketRead.model_validate(ticket).model_copy(update=ticket_context.get(ticket.id, {}))


def _ticket_context(db: Session, hotel_id: str, tickets: list[Ticket]) -> dict[str, dict[str, str | None]]:
    if not tickets:
        return {}

    user_names = _user_names(db, hotel_id, [ticket.assigned_to for ticket in tickets])
    room_numbers = _room_numbers(db, hotel_id, [ticket.room_id for ticket in tickets])
    guest_names = _guest_names(db, hotel_id, [ticket.guest_id for ticket in tickets])
    reservation_numbers = _reservation_numbers(db, hotel_id, [ticket.reservation_id for ticket in tickets])
    department_names = _department_names(db, hotel_id, [ticket.department_id for ticket in tickets])
    category_names = _category_names(db, hotel_id, [ticket.task_category_id for ticket in tickets])

    return {
        ticket.id: {
            "assigned_to_name": user_names.get(ticket.assigned_to or ""),
            "room_number": room_numbers.get(ticket.room_id or ""),
            "guest_name": guest_names.get(ticket.guest_id or ""),
            "reservation_no": reservation_numbers.get(ticket.reservation_id or ""),
            "department_name": department_names.get(ticket.department_id or ""),
            "task_category_name": category_names.get(ticket.task_category_id or ""),
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


def _department_names(db: Session, hotel_id: str, department_ids: list[str | None]) -> dict[str, str]:
    ids = {department_id for department_id in department_ids if department_id}
    if not ids:
        return {}
    rows = db.execute(
        select(Department.id, Department.name).where(
            Department.hotel_id == hotel_id,
            Department.id.in_(ids),
            Department.deleted_at.is_(None),
        )
    ).all()
    return {department_id: name for department_id, name in rows}


def _category_names(db: Session, hotel_id: str, category_ids: list[str | None]) -> dict[str, str]:
    ids = {category_id for category_id in category_ids if category_id}
    if not ids:
        return {}
    rows = db.execute(
        select(TicketCategory.id, TicketCategory.name).where(
            TicketCategory.hotel_id == hotel_id,
            TicketCategory.id.in_(ids),
            TicketCategory.is_active.is_(True),
        )
    ).all()
    return {category_id: name for category_id, name in rows}

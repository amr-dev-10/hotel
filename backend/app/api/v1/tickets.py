from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.ticket_repository import TicketRepository
from app.schemas.ticket import TicketCreate, TicketRead, TicketStageUpdate
from app.services.ticket_service import TicketService

router = APIRouter()


@router.get("")
def list_tickets(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    tickets = TicketRepository(db).list_for_hotel(hotel_id)
    return ok([TicketRead.model_validate(item).model_dump() for item in tickets])


@router.post("")
def create_ticket(
    hotel_id: str,
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    ticket = TicketService(db).create_ticket(hotel_id, payload, actor_id=current_user.id)
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.patch("/{ticket_id}/stage")
def update_ticket_stage(
    hotel_id: str,
    ticket_id: str,
    payload: TicketStageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    ticket = TicketService(db).update_stage(
        hotel_id,
        ticket_id,
        payload.stage,
        note=payload.note,
        actor_id=current_user.id,
    )
    return ok(TicketRead.model_validate(ticket).model_dump())

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.schemas.v51 import TicketCategoryRead
from app.services.ticket_category_service import TicketCategoryService

router = APIRouter()


@router.get("")
def list_ticket_categories(
    hotel_id: str,
    department_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    rows = TicketCategoryService(db).list_active(hotel_id, department_id)
    return ok([TicketCategoryRead.model_validate(row).model_dump() for row in rows])

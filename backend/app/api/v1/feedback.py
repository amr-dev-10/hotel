from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.feedback_repository import FeedbackRepository
from app.schemas.feedback import FeedbackCreate, FeedbackRead
from app.services.feedback_service import FeedbackService

router = APIRouter()


@router.get("")
def list_feedback(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    feedback = FeedbackRepository(db).list_for_hotel(hotel_id)
    return ok([FeedbackRead.model_validate(item).model_dump() for item in feedback])


@router.post("")
def create_feedback(
    hotel_id: str,
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.create")),
) -> dict:
    feedback = FeedbackService(db).create_feedback(hotel_id, payload)
    return ok(FeedbackRead.model_validate(feedback).model_dump())

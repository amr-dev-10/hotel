from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.feedback.models import Feedback
from app.modules.feedback.schemas import FeedbackCreate, FeedbackRead
from app.modules.hotel.dependencies import ensure_hotel_scope

router = APIRouter(prefix="/hotels/{hotel_id}/feedback", tags=["feedback"])


def _feedback_to_read(feedback: Feedback) -> FeedbackRead:
    return FeedbackRead(
        id=feedback.id,
        hotel_id=feedback.tenant_id,
        guest_id=feedback.guest_id,
        feedback_text=feedback.feedback_text,
        rating=feedback.rating,
    )


@router.post("", response_model=FeedbackRead, status_code=201)
def submit_feedback(
    hotel_id: str,
    payload: FeedbackCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> FeedbackRead:
    ensure_hotel_scope(hotel_id, context)
    feedback = Feedback(tenant_id=hotel_id, **payload.model_dump())
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return _feedback_to_read(feedback)


@router.get("", response_model=list[FeedbackRead])
def list_feedback(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[FeedbackRead]:
    ensure_hotel_scope(hotel_id, context)
    rows = db.scalars(select(Feedback).where(Feedback.tenant_id == hotel_id).order_by(Feedback.created_at.desc())).all()
    return [_feedback_to_read(feedback) for feedback in rows]

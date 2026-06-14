from sqlalchemy.orm import Session

from app.models.feedback import Feedback
from app.repositories.feedback_repository import FeedbackRepository
from app.schemas.feedback import FeedbackCreate


class FeedbackService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.feedback = FeedbackRepository(db)

    def create_feedback(self, hotel_id: str, payload: FeedbackCreate) -> Feedback:
        feedback = Feedback(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(feedback)
        self.db.commit()
        self.db.refresh(feedback)
        return feedback

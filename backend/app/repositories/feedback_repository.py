from app.models.feedback import Feedback
from app.repositories.base import BaseRepository


class FeedbackRepository(BaseRepository[Feedback]):
    def __init__(self, db) -> None:
        super().__init__(db, Feedback)

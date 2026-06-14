from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class FeedbackCreate(BaseModel):
    guest_id: str | None = None
    ticket_id: str | None = None
    rating: int = Field(ge=1, le=5)
    content: str | None = None


class FeedbackRead(ORMModel):
    id: str
    hotel_id: str
    guest_id: str | None = None
    ticket_id: str | None = None
    rating: int
    content: str | None = None

from pydantic import BaseModel, Field


class FeedbackCreate(BaseModel):
    guest_id: str | None = None
    feedback_text: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)


class FeedbackRead(BaseModel):
    id: str
    hotel_id: str
    guest_id: str | None
    feedback_text: str
    rating: int

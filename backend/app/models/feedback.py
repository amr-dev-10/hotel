from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Feedback(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "feedback"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"))
    rating: Mapped[int] = mapped_column(Integer)
    content: Mapped[str | None] = mapped_column(Text)

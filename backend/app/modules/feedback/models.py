from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class Feedback(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "feedback"

    guest_id: Mapped[str | None] = mapped_column(String(36), index=True)
    feedback_text: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class TicketAcceptance(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ticket_acceptances"

    ticket_id: Mapped[str] = mapped_column(ForeignKey("tickets.id"), index=True)
    offered_to: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    offered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
    response: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    auto_expired: Mapped[bool] = mapped_column(Boolean, default=False)
    expire_after_minutes: Mapped[int] = mapped_column(Integer, default=2)

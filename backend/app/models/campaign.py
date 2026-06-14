from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class Campaign(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "campaigns"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    template_name: Mapped[str] = mapped_column(String(100))
    target_type: Mapped[str] = mapped_column(String(50), default="all_active_guests")
    target_filter: Mapped[dict] = mapped_column(JSON, default=dict)
    target_guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    params: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    delivered_count: Mapped[int] = mapped_column(Integer, default=0)
    read_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))


class CampaignDelivery(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "campaign_deliveries"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    campaign_id: Mapped[str] = mapped_column(ForeignKey("campaigns.id"), index=True)
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    phone: Mapped[str] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(30), default="queued")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_detail: Mapped[str | None] = mapped_column(String(500))

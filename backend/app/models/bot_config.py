from sqlalchemy import Boolean, ForeignKey, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class BotConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "bot_configs"
    __table_args__ = (UniqueConstraint("hotel_id", name="uq_bot_configs_hotel"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    main_menu: Mapped[list[dict]] = mapped_column(JSON, default=list)
    services: Mapped[list[dict]] = mapped_column(JSON, default=list)
    messages: Mapped[dict] = mapped_column(JSON, default=dict)
    sla_config: Mapped[dict] = mapped_column(JSON, default=dict)
    active_hours: Mapped[dict] = mapped_column(JSON, default=dict)
    gemini_fallback_enabled: Mapped[bool] = mapped_column(Boolean, default=True)

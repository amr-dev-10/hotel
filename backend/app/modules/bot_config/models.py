from typing import Any

from sqlalchemy import JSON, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class BotConfig(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "bot_config"
    __table_args__ = (UniqueConstraint("tenant_id", name="uq_bot_config_tenant"),)

    main_menu: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    services: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    messages: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    default_sla_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    per_department_sla: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    active_hours: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

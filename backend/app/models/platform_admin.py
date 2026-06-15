from datetime import datetime

from sqlalchemy import Boolean, DateTime, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class PlatformAdmin(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "platform_admins"

    name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PlatformSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "platform_settings"
    __table_args__ = (UniqueConstraint("key", name="uq_platform_settings_key"),)

    key: Mapped[str] = mapped_column(String(120), index=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON)
    description: Mapped[str | None] = mapped_column(Text)
    updated_by: Mapped[str | None] = mapped_column(String(36))

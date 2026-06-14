from enum import Enum

from sqlalchemy import Boolean, Enum as SqlEnum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UuidPrimaryKeyMixin


class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    CANCELLED = "cancelled"


class Tenant(Base, UuidPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "tenants"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(40))
    address: Mapped[str | None] = mapped_column(String(255))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC", nullable=False)
    subscription: Mapped[str] = mapped_column(String(80), default="trial", nullable=False)
    owner_user_id: Mapped[str | None] = mapped_column(String(36), index=True)
    status: Mapped[TenantStatus] = mapped_column(SqlEnum(TenantStatus), default=TenantStatus.ACTIVE, nullable=False)


class PlatformUser(Base, UuidPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "platform_users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

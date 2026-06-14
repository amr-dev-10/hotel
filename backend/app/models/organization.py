from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin, utcnow


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    logo_url: Mapped[str | None] = mapped_column(String(800))
    contact_email: Mapped[str | None] = mapped_column(String(255))


class OrganizationHotel(Base):
    __tablename__ = "organization_hotels"
    __table_args__ = (UniqueConstraint("organization_id", "hotel_id", name="uq_org_hotel"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), primary_key=True)
    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), primary_key=True)
    role: Mapped[str] = mapped_column(String(40), default="owner")
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OrganizationUser(Base):
    __tablename__ = "organization_users"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_user"),)

    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), primary_key=True)
    org_role: Mapped[str] = mapped_column(String(60), default="org_admin")

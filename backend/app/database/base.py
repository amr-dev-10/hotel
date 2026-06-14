from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, func
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column, synonym
from sqlalchemy.types import Uuid


class Base(DeclarativeBase):
    pass


class UuidPrimaryKeyMixin:
    id: Mapped[str] = mapped_column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class HotelOwnedMixin:
    hotel_id: Mapped[str] = mapped_column(Uuid(as_uuid=False), index=True, nullable=False)

    @declared_attr
    def tenant_id(cls):
        return synonym("hotel_id")


class TenantOwnedMixin(HotelOwnedMixin):
    """Compatibility alias while v1 moves tenant-owned tables to hotel_id."""

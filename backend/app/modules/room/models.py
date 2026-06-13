from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class Room(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("tenant_id", "room_number", name="uq_rooms_tenant_room_number"),)

    room_number: Mapped[str] = mapped_column(String(40), nullable=False)
    room_type: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(40), default="available", index=True, nullable=False)

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class Guest(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "guests"

    room_id: Mapped[str | None] = mapped_column(String(36), index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40), index=True)
    whatsapp_phone: Mapped[str | None] = mapped_column(String(40), index=True)
    check_in_date: Mapped[str | None] = mapped_column(String(40))
    check_out_date: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(40), default="checked_in", index=True, nullable=False)

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Hotel(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "hotels"

    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC")
    contact_email: Mapped[str | None] = mapped_column(String(255))
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    logo_url: Mapped[str | None] = mapped_column(String(500))
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(
        String(80),
        unique=True,
        index=True,
    )
    subscription_tier: Mapped[str] = mapped_column(String(40), default="starter")
    status: Mapped[str] = mapped_column(String(40), default="active")
    owner_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", name="fk_hotels_owner_user_id_users", use_alter=True)
    )

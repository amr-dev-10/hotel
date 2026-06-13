from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class Activity(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "activities"

    actor_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(120), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    entity_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)

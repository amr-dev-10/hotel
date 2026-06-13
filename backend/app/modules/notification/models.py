from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, TimestampMixin, UuidPrimaryKeyMixin


class NotificationTemplate(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "notification_templates"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    channel: Mapped[str] = mapped_column(String(40), default="email", nullable=False)
    subject: Mapped[str | None] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, nullable=False)


class Notification(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "notifications"

    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    channel: Mapped[str] = mapped_column(String(40), nullable=False)
    subject: Mapped[str | None] = mapped_column(String(180))
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="queued", index=True, nullable=False)


class NotificationQueue(Base, UuidPrimaryKeyMixin, TenantOwnedMixin, TimestampMixin):
    __tablename__ = "notification_queue"

    notification_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True, nullable=False)
    error: Mapped[str | None] = mapped_column(Text)

from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TimestampMixin, UuidPrimaryKeyMixin


class FcmToken(Base, UuidPrimaryKeyMixin, TimestampMixin):
    __tablename__ = "fcm_tokens"
    __table_args__ = (UniqueConstraint("user_id", "token", name="uq_fcm_tokens_user_token"),)

    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    token: Mapped[str] = mapped_column(String(500), nullable=False)
    platform: Mapped[str] = mapped_column(String(40), default="android", nullable=False)

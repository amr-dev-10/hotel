from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, UuidPrimaryKeyMixin


class Role(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_roles_hotel_name"),)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))


class UserRole(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "user_roles"
    __table_args__ = (UniqueConstraint("hotel_id", "user_id", "role_id", name="uq_user_roles_hotel_user_role"),)

    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    role_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)

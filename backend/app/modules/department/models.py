from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, UuidPrimaryKeyMixin


class Department(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("hotel_id", "key", name="uq_departments_hotel_key"),)

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    key: Mapped[str] = mapped_column(String(80), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

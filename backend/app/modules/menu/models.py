from decimal import Decimal

from sqlalchemy import Boolean, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, UuidPrimaryKeyMixin


class MenuCategory(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "menu_categories"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    type: Mapped[str] = mapped_column(String(40), default="food", index=True, nullable=False)
    display_order: Mapped[int] = mapped_column(default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class MenuItem(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "menu_items"

    category_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(default=0, nullable=False)

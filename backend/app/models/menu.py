from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class MenuCategory(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "menu_categories"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_menu_categories_hotel_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(40), default="food")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class MenuItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "menu_items"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("menu_categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    description: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

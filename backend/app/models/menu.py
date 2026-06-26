from decimal import Decimal

from sqlalchemy import Boolean, Column, ForeignKey, Integer, JSON, Numeric, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


menu_item_taxes = Table(
    "menu_item_taxes",
    Base.metadata,
    Column("menu_item_id", ForeignKey("menu_items.id"), primary_key=True),
    Column("tax_config_id", ForeignKey("tax_configs.id"), primary_key=True),
)


class MenuCategory(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "menu_categories"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_menu_categories_hotel_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(40), default="food")
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class MenuItem(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "menu_items"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("menu_categories.id"), index=True)
    name: Mapped[str] = mapped_column(String(180))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    description: Mapped[str | None] = mapped_column(Text)
    description_short: Mapped[str | None] = mapped_column(String(255))
    dietary_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    preparation_time_minutes: Mapped[int] = mapped_column(Integer, default=15)
    image_url: Mapped[str | None] = mapped_column(String(500))
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)

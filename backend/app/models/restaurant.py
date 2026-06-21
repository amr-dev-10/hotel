from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin, utcnow


class RestaurantTable(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "restaurant_tables"
    __table_args__ = (UniqueConstraint("hotel_id", "table_number", name="uq_restaurant_table_no"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    table_number: Mapped[str] = mapped_column(String(80), index=True)
    section: Mapped[str | None] = mapped_column(String(80))
    capacity: Mapped[int] = mapped_column(Integer, default=2)
    status: Mapped[str] = mapped_column(String(40), default="available", index=True)


class RestaurantOrder(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "restaurant_orders"
    __table_args__ = (UniqueConstraint("hotel_id", "order_number", name="uq_restaurant_order_no"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    order_number: Mapped[str] = mapped_column(String(80), index=True)
    source: Mapped[str] = mapped_column(String(40), default="pos", index=True)
    table_id: Mapped[str | None] = mapped_column(ForeignKey("restaurant_tables.id"))
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"))
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"))
    folio_id: Mapped[str | None] = mapped_column(ForeignKey("guest_folios.id"))
    ordered_by_guest: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(40), default="received", index=True)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    special_instructions: Mapped[str | None] = mapped_column(Text)
    taken_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RestaurantOrderItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "restaurant_order_items"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    order_id: Mapped[str] = mapped_column(ForeignKey("restaurant_orders.id"), index=True)
    menu_item_id: Mapped[str] = mapped_column(ForeignKey("menu_items.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    item_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    status: Mapped[str] = mapped_column(String(40), default="ordered", index=True)
    notes: Mapped[str | None] = mapped_column(String(255))

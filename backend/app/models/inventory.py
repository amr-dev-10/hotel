from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin, utcnow


class Vendor(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "vendors"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    contact_phone: Mapped[str | None] = mapped_column(String(40))
    contact_email: Mapped[str | None] = mapped_column(String(255))
    address: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_items"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_inventory_hotel_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True)
    unit: Mapped[str] = mapped_column(String(40), default="piece")
    min_stock: Mapped[int] = mapped_column(Integer, default=0)
    current_stock: Mapped[int] = mapped_column(Integer, default=0)
    cost_per_unit: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    default_vendor_id: Mapped[str | None] = mapped_column(ForeignKey("vendors.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class InventoryTransaction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "inventory_transactions"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    transaction_type: Mapped[str] = mapped_column(String(40), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    reference_type: Mapped[str | None] = mapped_column(String(80), index=True)
    reference_id: Mapped[str | None] = mapped_column(String(36), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    performed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PurchaseOrder(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (UniqueConstraint("hotel_id", "po_number", name="uq_purchase_order_no"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    po_number: Mapped[str] = mapped_column(String(80), index=True)
    vendor_id: Mapped[str] = mapped_column(ForeignKey("vendors.id"))
    status: Mapped[str] = mapped_column(String(40), default="draft", index=True)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PurchaseOrderItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "purchase_order_items"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    purchase_order_id: Mapped[str] = mapped_column(ForeignKey("purchase_orders.id"), index=True)
    item_id: Mapped[str] = mapped_column(ForeignKey("inventory_items.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    received_qty: Mapped[int] = mapped_column(Integer, default=0)

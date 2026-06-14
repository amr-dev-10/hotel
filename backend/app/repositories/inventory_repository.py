from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import (
    InventoryItem,
    InventoryTransaction,
    PurchaseOrder,
    PurchaseOrderItem,
    Vendor,
)
from app.repositories.base import BaseRepository


class VendorRepository(BaseRepository[Vendor]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Vendor)


class InventoryItemRepository(BaseRepository[InventoryItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, InventoryItem)

    def get_by_name(self, hotel_id: str, name: str) -> InventoryItem | None:
        return self.db.execute(
            select(InventoryItem).where(
                InventoryItem.hotel_id == hotel_id,
                InventoryItem.name == name,
                InventoryItem.is_active.is_(True),
            )
        ).scalar_one_or_none()

    def low_stock(self, hotel_id: str) -> Sequence[InventoryItem]:
        return self.db.execute(
            select(InventoryItem).where(
                InventoryItem.hotel_id == hotel_id,
                InventoryItem.is_active.is_(True),
                InventoryItem.current_stock < InventoryItem.min_stock,
            )
        ).scalars().all()


class InventoryTransactionRepository(BaseRepository[InventoryTransaction]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, InventoryTransaction)


class PurchaseOrderRepository(BaseRepository[PurchaseOrder]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, PurchaseOrder)


class PurchaseOrderItemRepository(BaseRepository[PurchaseOrderItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, PurchaseOrderItem)

    def list_for_order(self, hotel_id: str, purchase_order_id: str) -> Sequence[PurchaseOrderItem]:
        return self.db.execute(
            select(PurchaseOrderItem).where(
                PurchaseOrderItem.hotel_id == hotel_id,
                PurchaseOrderItem.purchase_order_id == purchase_order_id,
            )
        ).scalars().all()

from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.inventory import InventoryItem, InventoryTransaction, PurchaseOrder, PurchaseOrderItem, Vendor
from app.repositories.inventory_repository import (
    InventoryItemRepository,
    InventoryTransactionRepository,
    PurchaseOrderItemRepository,
    PurchaseOrderRepository,
    VendorRepository,
)
from app.schemas.inventory import (
    InventoryIssueRequest,
    InventoryItemCreate,
    PurchaseOrderCreate,
    VendorCreate,
)
from app.schemas.ops import NotificationCreate
from app.services.audit_service import AuditService
from app.services.ops_service import NotificationCenterService


class InventoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.vendors = VendorRepository(db)
        self.items = InventoryItemRepository(db)
        self.transactions = InventoryTransactionRepository(db)
        self.purchase_orders = PurchaseOrderRepository(db)
        self.purchase_order_items = PurchaseOrderItemRepository(db)
        self.audit = AuditService(db)

    def create_vendor(self, hotel_id: str, payload: VendorCreate, actor_id: str | None) -> Vendor:
        vendor = Vendor(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(vendor)
        self.audit.log(hotel_id, "vendor.created", "vendor", None, actor_id)
        self.db.commit()
        self.db.refresh(vendor)
        return vendor

    def create_item(self, hotel_id: str, payload: InventoryItemCreate, actor_id: str | None) -> InventoryItem:
        if payload.default_vendor_id and not self.vendors.get_for_hotel(hotel_id, payload.default_vendor_id):
            raise not_found("Vendor not found")
        item = InventoryItem(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(item)
        self.audit.log(hotel_id, "inventory.item.created", "inventory_item", None, actor_id)
        self.db.commit()
        self.db.refresh(item)
        return item

    def issue_item(
        self,
        hotel_id: str,
        payload: InventoryIssueRequest,
        actor_id: str | None,
        commit: bool = True,
    ) -> InventoryTransaction:
        item = self.items.get_for_hotel(hotel_id, payload.item_id)
        if not item:
            raise not_found("Inventory item not found")
        if payload.quantity <= 0:
            raise bad_request("quantity must be positive")
        item.current_stock -= payload.quantity
        transaction = InventoryTransaction(
            hotel_id=hotel_id,
            item_id=item.id,
            transaction_type="issue",
            quantity=-payload.quantity,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            notes=payload.notes,
            performed_by=actor_id,
        )
        self.db.add(transaction)
        self._notify_low_stock(item)
        self.audit.log(hotel_id, "inventory.issued", "inventory_item", item.id, actor_id)
        if commit:
            self.db.commit()
            self.db.refresh(transaction)
        return transaction

    def adjust_stock(
        self,
        hotel_id: str,
        item_id: str,
        quantity: int,
        transaction_type: str,
        actor_id: str | None,
        reference_type: str = "manual",
        reference_id: str | None = None,
        notes: str | None = None,
        commit: bool = True,
    ) -> InventoryTransaction:
        item = self.items.get_for_hotel(hotel_id, item_id)
        if not item:
            raise not_found("Inventory item not found")
        item.current_stock += quantity
        transaction = InventoryTransaction(
            hotel_id=hotel_id,
            item_id=item.id,
            transaction_type=transaction_type,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            performed_by=actor_id,
        )
        self.db.add(transaction)
        self._notify_low_stock(item)
        if commit:
            self.db.commit()
            self.db.refresh(transaction)
        return transaction

    def create_purchase_order(
        self,
        hotel_id: str,
        payload: PurchaseOrderCreate,
        actor_id: str | None,
    ) -> PurchaseOrder:
        if not self.vendors.get_for_hotel(hotel_id, payload.vendor_id):
            raise not_found("Vendor not found")
        total = sum(Decimal(item.quantity) * Decimal(item.unit_price) for item in payload.items)
        order = PurchaseOrder(
            hotel_id=hotel_id,
            po_number=self._po_number(),
            vendor_id=payload.vendor_id,
            status="draft",
            total_amount=total,
            notes=payload.notes,
            created_by=actor_id,
        )
        self.db.add(order)
        self.db.flush()
        for item in payload.items:
            if not self.items.get_for_hotel(hotel_id, item.item_id):
                raise not_found("Inventory item not found")
            self.db.add(
                PurchaseOrderItem(
                    hotel_id=hotel_id,
                    purchase_order_id=order.id,
                    item_id=item.item_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                )
            )
        self.audit.log(hotel_id, "purchase_order.created", "purchase_order", order.id, actor_id)
        self.db.commit()
        self.db.refresh(order)
        return order

    def receive_purchase_order(
        self,
        hotel_id: str,
        purchase_order_id: str,
        actor_id: str | None,
    ) -> PurchaseOrder:
        order = self.purchase_orders.get_for_hotel(hotel_id, purchase_order_id)
        if not order:
            raise not_found("Purchase order not found")
        for item in self.purchase_order_items.list_for_order(hotel_id, order.id):
            received_qty = item.received_qty or item.quantity
            item.received_qty = received_qty
            self.adjust_stock(
                hotel_id,
                item.item_id,
                received_qty,
                "purchase",
                actor_id,
                reference_type="purchase_order",
                reference_id=order.id,
                commit=False,
            )
        order.status = "received"
        order.received_at = utcnow()
        self.audit.log(hotel_id, "purchase_order.received", "purchase_order", order.id, actor_id)
        self.db.commit()
        self.db.refresh(order)
        return order

    def issue_for_housekeeping(
        self,
        hotel_id: str,
        housekeeping_task_id: str,
        checklist_items: list,
        actor_id: str | None,
    ) -> list[InventoryTransaction]:
        transactions = []
        for checklist_item in checklist_items:
            name, quantity = self._parse_checklist_item(checklist_item)
            item = self.items.get_by_name(hotel_id, name)
            if not item:
                continue
            transactions.append(
                self.issue_item(
                    hotel_id,
                    InventoryIssueRequest(
                        item_id=item.id,
                        quantity=quantity,
                        reference_type="housekeeping_task",
                        reference_id=housekeeping_task_id,
                    ),
                    actor_id,
                    commit=False,
                )
            )
        return transactions

    def _notify_low_stock(self, item: InventoryItem) -> None:
        if item.current_stock < item.min_stock:
            NotificationCenterService(self.db).create(
                item.hotel_id,
                NotificationCreate(
                    channel="websocket",
                    title=f"Low Stock: {item.name}",
                    message=f"{item.current_stock} remaining, minimum is {item.min_stock}.",
                    metadata={"inventory_item_id": item.id},
                ),
                commit=False,
            )

    def _parse_checklist_item(self, value) -> tuple[str, int]:
        if isinstance(value, dict):
            return str(value.get("item") or value.get("name")), int(value.get("qty") or value.get("quantity") or 1)
        text = str(value)
        if ":" in text:
            name, qty = text.rsplit(":", 1)
            return name.strip(), int(qty.strip() or 1)
        return text.strip(), 1

    def _po_number(self) -> str:
        return f"PO-{utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:4].upper()}"

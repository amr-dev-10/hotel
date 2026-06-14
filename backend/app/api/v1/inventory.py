from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.inventory_repository import (
    InventoryItemRepository,
    InventoryTransactionRepository,
    PurchaseOrderItemRepository,
    PurchaseOrderRepository,
    VendorRepository,
)
from app.schemas.inventory import (
    InventoryAdjustRequest,
    InventoryIssueRequest,
    InventoryItemCreate,
    InventoryItemRead,
    InventoryTransactionRead,
    PurchaseOrderCreate,
    PurchaseOrderItemRead,
    PurchaseOrderRead,
    VendorCreate,
    VendorRead,
)
from app.services.inventory_service import InventoryService

router = APIRouter()


@router.get("/vendors")
def list_vendors(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    vendors = VendorRepository(db).list_for_hotel(hotel_id)
    return ok([VendorRead.model_validate(item).model_dump() for item in vendors])


@router.post("/vendors")
def create_vendor(
    hotel_id: str,
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    vendor = InventoryService(db).create_vendor(hotel_id, payload, current_user.id)
    return ok(VendorRead.model_validate(vendor).model_dump())


@router.get("/items")
def list_items(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    items = InventoryItemRepository(db).list_for_hotel(hotel_id)
    return ok([InventoryItemRead.model_validate(item).model_dump() for item in items])


@router.post("/items")
def create_item(
    hotel_id: str,
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    item = InventoryService(db).create_item(hotel_id, payload, current_user.id)
    return ok(InventoryItemRead.model_validate(item).model_dump())


@router.get("/items/low-stock")
def low_stock_items(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    items = InventoryItemRepository(db).low_stock(hotel_id)
    return ok([InventoryItemRead.model_validate(item).model_dump() for item in items])


@router.post("/items/issue")
def issue_item(
    hotel_id: str,
    payload: InventoryIssueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    transaction = InventoryService(db).issue_item(hotel_id, payload, current_user.id)
    return ok(InventoryTransactionRead.model_validate(transaction).model_dump())


@router.post("/items/adjust")
def adjust_item(
    hotel_id: str,
    payload: InventoryAdjustRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    transaction = InventoryService(db).adjust_stock(
        hotel_id,
        payload.item_id,
        payload.quantity,
        payload.transaction_type,
        current_user.id,
        reference_type=payload.reference_type,
        reference_id=payload.reference_id,
        notes=payload.notes,
    )
    return ok(InventoryTransactionRead.model_validate(transaction).model_dump())


@router.get("/transactions")
def list_transactions(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    transactions = InventoryTransactionRepository(db).list_for_hotel(hotel_id)
    return ok([InventoryTransactionRead.model_validate(item).model_dump() for item in transactions])


@router.get("/purchase-orders")
def list_purchase_orders(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    orders = PurchaseOrderRepository(db).list_for_hotel(hotel_id)
    return ok([PurchaseOrderRead.model_validate(item).model_dump() for item in orders])


@router.post("/purchase-orders")
def create_purchase_order(
    hotel_id: str,
    payload: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    order = InventoryService(db).create_purchase_order(hotel_id, payload, current_user.id)
    return ok(PurchaseOrderRead.model_validate(order).model_dump())


@router.get("/purchase-orders/{purchase_order_id}/items")
def list_purchase_order_items(
    hotel_id: str,
    purchase_order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    items = PurchaseOrderItemRepository(db).list_for_order(hotel_id, purchase_order_id)
    return ok([PurchaseOrderItemRead.model_validate(item).model_dump() for item in items])


@router.post("/purchase-orders/{purchase_order_id}/receive")
def receive_purchase_order(
    hotel_id: str,
    purchase_order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.manage")),
) -> dict:
    order = InventoryService(db).receive_purchase_order(hotel_id, purchase_order_id, current_user.id)
    return ok(PurchaseOrderRead.model_validate(order).model_dump())

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.restaurant_repository import (
    RestaurantOrderItemRepository,
    RestaurantOrderRepository,
    RestaurantTableRepository,
)
from app.schemas.restaurant import (
    RestaurantOrderCreate,
    RestaurantOrderDetail,
    RestaurantOrderItemRead,
    RestaurantOrderRead,
    RestaurantOrderStatusUpdate,
    RestaurantTableCreate,
    RestaurantTableRead,
)
from app.services.restaurant_service import RestaurantService

router = APIRouter()


@router.get("/tables")
def list_tables(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    tables = RestaurantTableRepository(db).list_for_hotel(hotel_id)
    return ok([RestaurantTableRead.model_validate(item).model_dump() for item in tables])


@router.post("/tables")
def create_table(
    hotel_id: str,
    payload: RestaurantTableCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    table = RestaurantService(db).create_table(hotel_id, payload, current_user.id)
    return ok(RestaurantTableRead.model_validate(table).model_dump())


@router.get("/orders")
def list_orders(
    hotel_id: str,
    status: str | None = None,
    source: str | None = None,
    guest_id: str | None = None,
    room_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    orders = RestaurantOrderRepository(db).list_filtered(
        hotel_id,
        status=status,
        source=source,
        guest_id=guest_id,
        room_id=room_id,
    )
    return ok([RestaurantOrderRead.model_validate(item).model_dump() for item in orders])


@router.post("/orders")
def create_order(
    hotel_id: str,
    payload: RestaurantOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    order = RestaurantService(db).create_order(hotel_id, payload, current_user.id)
    return ok(RestaurantOrderRead.model_validate(order).model_dump())


@router.get("/orders/{order_id}")
def get_order(
    hotel_id: str,
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    from app.core.exceptions import not_found

    order = RestaurantOrderRepository(db).get_for_hotel(hotel_id, order_id)
    if not order:
        raise not_found("Restaurant order not found")
    items = RestaurantOrderItemRepository(db).list_for_order(hotel_id, order.id)
    detail = RestaurantOrderDetail(
        order=RestaurantOrderRead.model_validate(order),
        items=[RestaurantOrderItemRead.model_validate(item) for item in items],
    )
    return ok(detail.model_dump())


@router.get("/orders/{order_id}/items")
def list_order_items(
    hotel_id: str,
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    items = RestaurantOrderItemRepository(db).list_for_order(hotel_id, order_id)
    return ok([RestaurantOrderItemRead.model_validate(item).model_dump() for item in items])


@router.patch("/orders/{order_id}/status")
def update_order_status(
    hotel_id: str,
    order_id: str,
    payload: RestaurantOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("restaurant.manage")),
) -> dict:
    order = RestaurantService(db).update_status(hotel_id, order_id, payload, current_user.id)
    return ok(RestaurantOrderRead.model_validate(order).model_dump())

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.guest_dependencies import require_guest_session
from app.core.database import get_db
from app.core.exceptions import forbidden, not_found
from app.core.responses import ok
from app.repositories.menu_repository import MenuCategoryRepository, MenuItemRepository
from app.repositories.restaurant_repository import RestaurantOrderItemRepository, RestaurantOrderRepository
from app.repositories.ticket_repository import TicketRepository
from app.schemas.guest_portal import (
    GuestPortalLoginRequest,
    GuestPortalOrderCreate,
    GuestPortalOrderDetail,
    GuestPortalRequestCreate,
    GuestPortalTokenRequest,
)
from app.schemas.menu import MenuCategoryRead, MenuItemRead
from app.schemas.restaurant import RestaurantOrderCreate, RestaurantOrderItemRead, RestaurantOrderRead
from app.schemas.ticket import TicketCreate, TicketRead
from app.services.guest_portal_service import GuestPortalContext, GuestPortalService
from app.services.restaurant_service import RestaurantService
from app.services.ticket_service import TicketService

router = APIRouter()


@router.post("/auth/login")
def login(
    payload: GuestPortalLoginRequest,
    db: Session = Depends(get_db),
) -> dict:
    session = GuestPortalService(db).login(payload.hotel_id, payload.phone, payload.room_number)
    return ok(session.model_dump())


@router.post("/auth/token")
def verify_token(
    payload: GuestPortalTokenRequest,
    db: Session = Depends(get_db),
) -> dict:
    session = GuestPortalService(db).verify_link_token(payload.token)
    return ok(session.model_dump())


@router.get("/profile")
def profile(
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    return ok(GuestPortalService(db).profile(context).model_dump())


@router.get("/menu/categories")
def list_categories(
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    categories = MenuCategoryRepository(db).list_ordered(context.hotel_id, active_only=True)
    return ok([MenuCategoryRead.model_validate(item).model_dump() for item in categories])


@router.get("/menu/items")
def list_items(
    category_id: str | None = None,
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    items = MenuItemRepository(db).list_available(context.hotel_id, category_id)
    return ok([MenuItemRead.model_validate(item).model_dump() for item in items])


@router.post("/orders")
def create_order(
    payload: GuestPortalOrderCreate,
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    order = RestaurantService(db).create_order(
        context.hotel_id,
        RestaurantOrderCreate(
            source="guest_portal",
            guest_id=context.guest_id,
            room_id=context.room_id,
            special_instructions=payload.special_instructions,
            ordered_by_guest=True,
            items=payload.items,
        ),
        actor_id=None,
    )
    return ok(RestaurantOrderRead.model_validate(order).model_dump())


@router.get("/orders")
def list_orders(
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    orders = RestaurantOrderRepository(db).list_for_guest(
        context.hotel_id,
        context.guest_id,
        room_id=context.room_id,
    )
    return ok([RestaurantOrderRead.model_validate(item).model_dump() for item in orders])


@router.get("/orders/{order_id}")
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    order = RestaurantOrderRepository(db).get_for_hotel(context.hotel_id, order_id)
    if not order:
        raise not_found("Order not found")
    if order.guest_id != context.guest_id:
        raise forbidden("Order does not belong to this guest")
    items = RestaurantOrderItemRepository(db).list_for_order(context.hotel_id, order.id)
    detail = GuestPortalOrderDetail(
        order=RestaurantOrderRead.model_validate(order),
        items=[RestaurantOrderItemRead.model_validate(item) for item in items],
    )
    return ok(detail.model_dump())


@router.post("/requests")
def create_request(
    payload: GuestPortalRequestCreate,
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    ticket = TicketService(db).create_ticket(
        context.hotel_id,
        TicketCreate(
            guest_id=context.guest_id,
            reservation_id=context.reservation_id,
            room_id=context.room_id,
            department_key=payload.department_key,
            type="guest_request",
            task_category=payload.task_category,
            item_description=payload.item_description,
            source="PORTAL",
            priority=payload.priority,
        ),
        actor_id=None,
    )
    return ok(TicketRead.model_validate(ticket).model_dump())


@router.get("/requests")
def list_requests(
    db: Session = Depends(get_db),
    context: GuestPortalContext = Depends(require_guest_session),
) -> dict:
    tickets = TicketRepository(db).list_filtered(
        context.hotel_id,
        guest_id=context.guest_id,
        reservation_id=context.reservation_id,
    )
    return ok([TicketRead.model_validate(item).model_dump() for item in tickets if item.source == "PORTAL"])

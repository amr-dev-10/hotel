from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.restaurant import RestaurantOrder, RestaurantOrderItem, RestaurantTable
from app.repositories.folio_repository import FolioRepository
from app.repositories.menu_repository import MenuItemRepository
from app.repositories.restaurant_repository import (
    RestaurantOrderItemRepository,
    RestaurantOrderRepository,
    RestaurantTableRepository,
)
from app.schemas.folio import FolioItemCreate
from app.schemas.restaurant import RestaurantOrderCreate, RestaurantOrderStatusUpdate, RestaurantTableCreate
from app.schemas.ticket import TicketCreate
from app.services.audit_service import AuditService
from app.services.folio_service import FolioService
from app.services.ticket_service import TicketService


class RestaurantService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tables = RestaurantTableRepository(db)
        self.orders = RestaurantOrderRepository(db)
        self.order_items = RestaurantOrderItemRepository(db)
        self.menu_items = MenuItemRepository(db)
        self.folios = FolioRepository(db)

    def create_table(
        self,
        hotel_id: str,
        payload: RestaurantTableCreate,
        actor_id: str | None,
    ) -> RestaurantTable:
        table = RestaurantTable(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(table)
        AuditService(self.db).log(hotel_id, "restaurant.table.created", "restaurant_table", None, actor_id)
        self.db.commit()
        self.db.refresh(table)
        return table

    def create_order(
        self,
        hotel_id: str,
        payload: RestaurantOrderCreate,
        actor_id: str | None,
    ) -> RestaurantOrder:
        subtotal = Decimal("0")
        prepared_items = []
        for item_payload in payload.items:
            menu_item = self.menu_items.get_for_hotel(hotel_id, item_payload.menu_item_id)
            if not menu_item:
                raise not_found("Menu item not found")
            unit_price = Decimal(item_payload.unit_price if item_payload.unit_price is not None else menu_item.price)
            item_total = unit_price * Decimal(item_payload.quantity)
            subtotal += item_total
            prepared_items.append((item_payload, unit_price, item_total))
        total = subtotal + Decimal(payload.tax)
        folio_id = payload.folio_id
        if not folio_id and payload.source in {"room_service", "whatsapp"} and payload.guest_id:
            folio = self.folios.get_open_for_guest(hotel_id, payload.guest_id)
            folio_id = folio.id if folio else None
        order = RestaurantOrder(
            hotel_id=hotel_id,
            order_number=self._order_number(),
            source=payload.source,
            table_id=payload.table_id,
            guest_id=payload.guest_id,
            room_id=payload.room_id,
            ticket_id=payload.ticket_id,
            folio_id=folio_id,
            subtotal=subtotal,
            tax=payload.tax,
            total=total,
            special_instructions=payload.special_instructions,
            taken_by=actor_id,
        )
        self.db.add(order)
        self.db.flush()
        for item_payload, unit_price, item_total in prepared_items:
            self.db.add(
                RestaurantOrderItem(
                    hotel_id=hotel_id,
                    order_id=order.id,
                    menu_item_id=item_payload.menu_item_id,
                    quantity=item_payload.quantity,
                    unit_price=unit_price,
                    item_total=item_total,
                    notes=item_payload.notes,
                )
            )
        if order.folio_id:
            if not self.folios.get_for_hotel(hotel_id, order.folio_id):
                raise not_found("Folio not found")
            FolioService(self.db).add_item(
                hotel_id,
                order.folio_id,
                FolioItemCreate(
                    item_type="food",
                    description=f"Room Service - {order.order_number}",
                    quantity=1,
                    unit_price=subtotal,
                    tax_amount=payload.tax,
                    total_amount=total,
                ),
                posted_by=actor_id,
                commit=False,
            )
        if payload.source in {"room_service", "whatsapp"}:
            ticket = TicketService(self.db).create_ticket(
                hotel_id,
                TicketCreate(
                    guest_id=payload.guest_id,
                    room_id=payload.room_id,
                    department_key="food_beverage",
                    type="food_order",
                    item_description=f"Food order {order.order_number}",
                    source=payload.source,
                ),
                actor_id=actor_id,
                commit=False,
            )
            order.ticket_id = ticket.id
        AuditService(self.db).log(hotel_id, "restaurant.order.created", "restaurant_order", order.id, actor_id)
        self.db.commit()
        self.db.refresh(order)
        return order

    def update_status(
        self,
        hotel_id: str,
        order_id: str,
        payload: RestaurantOrderStatusUpdate,
        actor_id: str | None,
    ) -> RestaurantOrder:
        order = self.orders.get_for_hotel(hotel_id, order_id)
        if not order:
            raise not_found("Restaurant order not found")
        order.status = payload.status
        if payload.status in {"served", "billed", "cancelled"} and not order.completed_at:
            order.completed_at = utcnow()
        AuditService(self.db).log(
            hotel_id,
            "restaurant.order.status_changed",
            "restaurant_order",
            order.id,
            actor_id,
            {"status": payload.status},
        )
        self.db.commit()
        self.db.refresh(order)
        return order

    def _order_number(self) -> str:
        return f"ORD-{utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:4].upper()}"

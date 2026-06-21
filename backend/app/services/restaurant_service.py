from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.restaurant import RestaurantOrder, RestaurantOrderItem, RestaurantTable
from app.repositories.folio_repository import FolioRepository
from app.repositories.folio_repository import TaxConfigRepository
from app.repositories.menu_repository import MenuItemRepository
from app.repositories.restaurant_repository import (
    RestaurantOrderItemRepository,
    RestaurantOrderRepository,
    RestaurantTableRepository,
)
from app.schemas.folio import FolioItemCreate
from app.schemas.restaurant import (
    RestaurantOrderCreate,
    RestaurantOrderItemCreate,
    RestaurantOrderStatusUpdate,
    RestaurantOrderUpdate,
    RestaurantTableCreate,
)
from app.schemas.ticket import TicketCreate
from app.services.audit_service import AuditService
from app.services.folio_service import FolioService
from app.services.notification_service import NotificationService
from app.services.ticket_service import TicketService


class RestaurantService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.tables = RestaurantTableRepository(db)
        self.orders = RestaurantOrderRepository(db)
        self.order_items = RestaurantOrderItemRepository(db)
        self.menu_items = MenuItemRepository(db)
        self.folios = FolioRepository(db)
        self.taxes = TaxConfigRepository(db)
        self.notifications = NotificationService()

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
        calculated_tax = Decimal("0")
        prepared_items = []
        for item_payload in payload.items:
            menu_item = self.menu_items.get_for_hotel(hotel_id, item_payload.menu_item_id)
            if not menu_item:
                raise not_found("Menu item not found")
            unit_price = Decimal(item_payload.unit_price if item_payload.unit_price is not None else menu_item.price)
            item_total = unit_price * Decimal(item_payload.quantity)
            item_tax = self._calculate_item_tax(hotel_id, item_payload.menu_item_id, item_total)
            subtotal += item_total
            calculated_tax += item_tax
            prepared_items.append((item_payload, unit_price, item_total))
        tax_total = Decimal(payload.tax or calculated_tax)
        if tax_total == Decimal("0") and calculated_tax:
            tax_total = calculated_tax
        tax_total = self._money(tax_total)
        total = self._money(subtotal + tax_total)
        folio_id = payload.folio_id
        if not folio_id and payload.source in {"room_service", "whatsapp", "guest_portal"} and payload.guest_id:
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
            ordered_by_guest=payload.ordered_by_guest,
            subtotal=subtotal,
            tax=tax_total,
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
                    tax_amount=tax_total,
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
        self._publish_order_event(order, "restaurant.order.created")
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
        if payload.status in {"served", "billed", "cancelled", "delivered"} and not order.completed_at:
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
        self._publish_order_event(order, "restaurant.order.status_changed")
        return order

    def update_order(
        self,
        hotel_id: str,
        order_id: str,
        payload: RestaurantOrderUpdate,
        actor_id: str | None,
    ) -> RestaurantOrder:
        order = self.orders.get_for_hotel(hotel_id, order_id)
        if not order:
            raise not_found("Restaurant order not found")

        values = payload.model_dump(exclude_unset=True)
        items_provided = "items" in values
        values.pop("items", None)
        explicit_tax = values.pop("tax", None)
        status = values.get("status")

        for field in (
            "source",
            "table_id",
            "guest_id",
            "room_id",
            "ticket_id",
            "folio_id",
            "special_instructions",
            "ordered_by_guest",
            "status",
        ):
            if field in values:
                setattr(order, field, values[field])

        if order.folio_id and not self.folios.get_for_hotel(hotel_id, order.folio_id):
            raise not_found("Folio not found")

        if status in {"served", "billed", "cancelled", "delivered"} and not order.completed_at:
            order.completed_at = utcnow()

        if items_provided:
            item_payloads = payload.items or []
            subtotal, calculated_tax, prepared_items = self._prepare_order_items(hotel_id, item_payloads)
            tax_total = self._money(Decimal(explicit_tax if explicit_tax is not None else calculated_tax))
            order.subtotal = subtotal
            order.tax = tax_total
            order.total = self._money(subtotal + tax_total)
            self.db.execute(
                delete(RestaurantOrderItem).where(
                    RestaurantOrderItem.hotel_id == hotel_id,
                    RestaurantOrderItem.order_id == order.id,
                )
            )
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
        elif explicit_tax is not None:
            order.tax = self._money(Decimal(explicit_tax))
            order.total = self._money(Decimal(order.subtotal) + Decimal(order.tax))

        AuditService(self.db).log(
            hotel_id,
            "restaurant.order.updated",
            "restaurant_order",
            order.id,
            actor_id,
            {"status": order.status, "items_replaced": items_provided},
        )
        self.db.commit()
        self.db.refresh(order)
        self._publish_order_event(order, "restaurant.order.updated")
        return order

    def _order_number(self) -> str:
        return f"ORD-{utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:4].upper()}"

    def _prepare_order_items(
        self,
        hotel_id: str,
        item_payloads: list[RestaurantOrderItemCreate],
    ) -> tuple[Decimal, Decimal, list[tuple[RestaurantOrderItemCreate, Decimal, Decimal]]]:
        subtotal = Decimal("0")
        calculated_tax = Decimal("0")
        prepared_items = []
        for item_payload in item_payloads:
            menu_item = self.menu_items.get_for_hotel(hotel_id, item_payload.menu_item_id)
            if not menu_item:
                raise not_found("Menu item not found")
            unit_price = Decimal(item_payload.unit_price if item_payload.unit_price is not None else menu_item.price)
            item_total = unit_price * Decimal(item_payload.quantity)
            item_tax = self._calculate_item_tax(hotel_id, item_payload.menu_item_id, item_total)
            subtotal += item_total
            calculated_tax += item_tax
            prepared_items.append((item_payload, unit_price, item_total))
        return subtotal, calculated_tax, prepared_items

    def _calculate_item_tax(self, hotel_id: str, menu_item_id: str, item_total: Decimal) -> Decimal:
        taxes = self.menu_items.tax_configs_for_item(hotel_id, menu_item_id)
        if not taxes:
            taxes = self.taxes.active_for_type(hotel_id, "food")
        tax_total = Decimal("0")
        for tax in taxes:
            if getattr(tax, "tax_type", "percentage") == "fixed":
                tax_total += Decimal(tax.fixed_amount or 0)
            else:
                tax_total += item_total * (Decimal(tax.rate_percent or 0) / Decimal("100"))
        return self._money(tax_total)

    def _money(self, value: Decimal) -> Decimal:
        return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def _publish_order_event(self, order: RestaurantOrder, event: str) -> None:
        self.notifications.publish_order_event(
            order.hotel_id,
            {
                "event": event,
                "order_id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "source": order.source,
                "guest_id": order.guest_id,
                "room_id": order.room_id,
                "total": str(order.total),
            },
        )

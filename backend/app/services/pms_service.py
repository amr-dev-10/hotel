from datetime import date

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.ops import HousekeepingSchedule, LostFoundItem, MaintenanceOrder
from app.models.ticket import Ticket
from app.repositories.ops_repository import (
    HousekeepingChecklistRepository,
    HousekeepingScheduleRepository,
    LostFoundRepository,
    MaintenanceOrderRepository,
)
from app.repositories.room_repository import RoomRepository
from app.schemas.pms import (
    HousekeepingCreate,
    HousekeepingUpdate,
    LostFoundCreate,
    LostFoundUpdate,
    MaintenanceCreate,
    MaintenanceUpdate,
)
from app.services.audit_service import AuditService


class HousekeepingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.schedules = HousekeepingScheduleRepository(db)
        self.checklists = HousekeepingChecklistRepository(db)
        self.rooms = RoomRepository(db)
        self.audit = AuditService(db)

    def create(self, hotel_id: str, payload: HousekeepingCreate, actor_id: str | None) -> HousekeepingSchedule:
        if not self.rooms.get_for_hotel(hotel_id, payload.room_id):
            raise not_found("Room not found")
        task = HousekeepingSchedule(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(task)
        self.audit.log(hotel_id, "housekeeping.created", "housekeeping", None, actor_id)
        self.db.commit()
        self.db.refresh(task)
        return task

    def create_checkout_clean(
        self,
        hotel_id: str,
        room_id: str,
        actor_id: str | None = None,
        commit: bool = False,
    ) -> HousekeepingSchedule:
        task = HousekeepingSchedule(
            hotel_id=hotel_id,
            room_id=room_id,
            task_type="checkout_clean",
            scheduled_date=date.today(),
            status="pending",
            priority=1,
            notes="Generated after guest checkout.",
        )
        self.db.add(task)
        self.audit.log(hotel_id, "housekeeping.checkout_clean.created", "housekeeping", None, actor_id)
        if commit:
            self.db.commit()
            self.db.refresh(task)
        return task

    def update(
        self,
        hotel_id: str,
        task_id: str,
        payload: HousekeepingUpdate,
        actor_id: str | None,
    ) -> HousekeepingSchedule:
        task = self.schedules.get_for_hotel(hotel_id, task_id)
        if not task:
            raise not_found("Housekeeping task not found")
        old_status = task.status
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(task, key, value)
        if task.status == "in_progress" and not task.started_at:
            task.started_at = utcnow()
        if task.status == "completed" and not task.completed_at:
            task.completed_at = utcnow()
            room = self.rooms.get_for_hotel(hotel_id, task.room_id)
            if room and room.status == "cleaning":
                room.status = "available"
        if old_status != "completed" and task.status == "completed":
            checklist = self.checklists.get_for_task_type(hotel_id, task.task_type)
            if checklist and checklist.items:
                from app.services.inventory_service import InventoryService

                InventoryService(self.db).issue_for_housekeeping(
                    hotel_id,
                    task.id,
                    checklist.items,
                    actor_id,
                )
        self.audit.log(hotel_id, "housekeeping.updated", "housekeeping", task.id, actor_id)
        self.db.commit()
        self.db.refresh(task)
        return task


class MaintenanceService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.orders = MaintenanceOrderRepository(db)
        self.audit = AuditService(db)

    def create(self, hotel_id: str, payload: MaintenanceCreate, actor_id: str | None) -> MaintenanceOrder:
        order = MaintenanceOrder(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(order)
        self.audit.log(hotel_id, "maintenance.created", "maintenance", None, actor_id)
        self.db.commit()
        self.db.refresh(order)
        return order

    def create_from_ticket(self, ticket: Ticket, category: str = "other", commit: bool = False) -> MaintenanceOrder:
        order = MaintenanceOrder(
            hotel_id=ticket.hotel_id,
            room_id=ticket.room_id,
            ticket_id=ticket.id,
            reported_by=None,
            assigned_to=ticket.assigned_to,
            category=category,
            description=ticket.item_description,
            priority="high" if ticket.priority >= 3 else "medium",
            status="reported",
        )
        self.db.add(order)
        if commit:
            self.db.commit()
            self.db.refresh(order)
        return order

    def update(
        self,
        hotel_id: str,
        order_id: str,
        payload: MaintenanceUpdate,
        actor_id: str | None,
    ) -> MaintenanceOrder:
        order = self.orders.get_for_hotel(hotel_id, order_id)
        if not order:
            raise not_found("Maintenance order not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(order, key, value)
        if order.status == "completed" and not order.completed_at:
            order.completed_at = utcnow()
        self.audit.log(hotel_id, "maintenance.updated", "maintenance", order.id, actor_id)
        self.db.commit()
        self.db.refresh(order)
        return order


class LostFoundService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.items = LostFoundRepository(db)
        self.audit = AuditService(db)

    def create(self, hotel_id: str, payload: LostFoundCreate, actor_id: str | None) -> LostFoundItem:
        item = LostFoundItem(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(item)
        self.audit.log(hotel_id, "lost_found.created", "lost_found", None, actor_id)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update(
        self,
        hotel_id: str,
        item_id: str,
        payload: LostFoundUpdate,
        actor_id: str | None,
    ) -> LostFoundItem:
        item = self.items.get_for_hotel(hotel_id, item_id)
        if not item:
            raise not_found("Lost and found item not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        self.audit.log(hotel_id, "lost_found.updated", "lost_found", item.id, actor_id)
        self.db.commit()
        self.db.refresh(item)
        return item

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.task_type_sla import TaskTypeSLA
from app.repositories.department_repository import DepartmentRepository
from app.repositories.knowledge_repository import DepartmentConfigRepository
from app.repositories.task_type_sla_repository import TaskTypeSLARepository
from app.schemas.v51 import TaskTypeSLACreate, TaskTypeSLAUpdate


@dataclass(frozen=True)
class SLAConfig:
    sla_minutes: int
    accept_timeout_minutes: int


DEFAULT_TASK_SLAS = {
    "housekeeping": [
        ("towel_request", 10, 2, "Extra towels and amenity requests."),
        ("extra_pillow", 10, 2, "Extra pillow request."),
        ("extra_blanket", 10, 2, "Extra blanket request."),
        ("checkout_clean", 45, 5, "Room cleaning after checkout."),
        ("occupied_clean", 13, 2, "Occupied room cleaning."),
        ("turndown_service", 15, 2, "Evening turndown service."),
        ("deep_clean", 60, 5, "Deep cleaning task."),
    ],
    "food_beverage": [
        ("food_order", 45, 3, "Food order service."),
        ("food_prep_room_svc", 45, 3, "Room-service food preparation."),
        ("drink_order", 20, 2, "Drink order service."),
    ],
    "engineering": [
        ("ac_repair", 20, 2, "Air-conditioning repair."),
        ("plumbing", 30, 5, "Plumbing issue."),
        ("electrical", 25, 3, "Electrical issue."),
        ("tv_repair", 20, 2, "TV repair."),
    ],
    "front_office": [
        ("general_request", 15, 2, "General front-office request."),
        ("taxi_booking", 10, 2, "Taxi or cab booking."),
        ("luggage_assist", 10, 2, "Luggage assistance."),
    ],
}


class SLAService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.slas = TaskTypeSLARepository(db)
        self.departments = DepartmentRepository(db)
        self.department_configs = DepartmentConfigRepository(db)

    def get_sla_config(
        self,
        hotel_id: str,
        department_id: str | None,
        task_category: str | None,
    ) -> SLAConfig:
        task_sla = self.slas.find(hotel_id, department_id, task_category)
        if task_sla:
            return SLAConfig(task_sla.sla_minutes, task_sla.accept_timeout_minutes)
        if department_id:
            config = self.department_configs.get_for_department(hotel_id, department_id)
            if config and config.sla_minutes:
                return SLAConfig(config.sla_minutes, 2)
        return SLAConfig(10, 2)

    def create(self, hotel_id: str, department_id: str, payload: TaskTypeSLACreate) -> TaskTypeSLA:
        if not self.departments.get_for_hotel(hotel_id, department_id):
            raise not_found("Department not found")
        existing = self.slas.find(hotel_id, department_id, payload.task_category)
        if existing:
            existing.sla_minutes = payload.sla_minutes
            existing.accept_timeout_minutes = payload.accept_timeout_minutes
            existing.description = payload.description
            existing.is_active = payload.is_active
            self.db.commit()
            self.db.refresh(existing)
            return existing
        row = TaskTypeSLA(hotel_id=hotel_id, department_id=department_id, **payload.model_dump())
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def update(
        self,
        hotel_id: str,
        department_id: str,
        sla_id: str,
        payload: TaskTypeSLAUpdate,
    ) -> TaskTypeSLA:
        row = self.slas.get_for_hotel(hotel_id, sla_id)
        if not row or row.department_id != department_id:
            raise not_found("Task SLA not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(row, key, value)
        self.db.commit()
        self.db.refresh(row)
        return row

    def delete(self, hotel_id: str, department_id: str, sla_id: str) -> None:
        row = self.slas.get_for_hotel(hotel_id, sla_id)
        if not row or row.department_id != department_id:
            raise not_found("Task SLA not found")
        row.is_active = False
        self.db.commit()

    def seed_defaults(self, hotel_id: str, department_ids: dict[str, str]) -> None:
        for department_key, rows in DEFAULT_TASK_SLAS.items():
            department_id = department_ids.get(department_key)
            if not department_id:
                continue
            for task_category, sla_minutes, accept_timeout, description in rows:
                if self.slas.find(hotel_id, department_id, task_category):
                    continue
                self.db.add(
                    TaskTypeSLA(
                        hotel_id=hotel_id,
                        department_id=department_id,
                        task_category=task_category,
                        sla_minutes=sla_minutes,
                        accept_timeout_minutes=accept_timeout,
                        description=description,
                        is_active=True,
                    )
                )

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.ticket_category import TicketCategory
from app.repositories.department_repository import DepartmentRepository
from app.repositories.ticket_category_repository import TicketCategoryRepository
from app.services.defaults import DEFAULT_TICKET_CATEGORIES


class TicketCategoryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.categories = TicketCategoryRepository(db)
        self.departments = DepartmentRepository(db)

    def list_active(self, hotel_id: str, department_id: str | None = None) -> list[TicketCategory]:
        return list(self.categories.list_active(hotel_id, department_id))

    def ensure(
        self,
        hotel_id: str,
        key: str,
        department_id: str | None = None,
        name: str | None = None,
        description: str | None = None,
        sla_minutes: int = 10,
        accept_timeout_minutes: int = 2,
        default_priority: int = 2,
    ) -> TicketCategory:
        existing = self.categories.get_by_key(hotel_id, key)
        if existing:
            return existing
        if department_id and not self.departments.get_for_hotel(hotel_id, department_id):
            raise not_found("Department not found")
        row = TicketCategory(
            hotel_id=hotel_id,
            department_id=department_id,
            key=key,
            name=name or key.replace("_", " ").title(),
            description=description,
            sla_minutes=sla_minutes,
            accept_timeout_minutes=accept_timeout_minutes,
            default_priority=default_priority,
            is_active=True,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def seed_defaults(self, hotel_id: str, department_ids: dict[str, str]) -> None:
        for item in DEFAULT_TICKET_CATEGORIES:
            department_id = department_ids.get(item["department_key"])
            if not department_id or self.categories.get_by_key(hotel_id, item["key"]):
                continue
            self.db.add(
                TicketCategory(
                    hotel_id=hotel_id,
                    department_id=department_id,
                    key=item["key"],
                    name=item["name"],
                    description=item["description"],
                    default_priority=item["default_priority"],
                    sla_minutes=item["sla_minutes"],
                    accept_timeout_minutes=item["accept_timeout_minutes"],
                    is_active=True,
                )
            )
        self.db.flush()

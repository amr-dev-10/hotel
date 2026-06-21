from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department import Department
from app.models.ticket_category import TicketCategory
from app.repositories.base import BaseRepository


class TicketCategoryRepository(BaseRepository[TicketCategory]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, TicketCategory)

    def list_active(
        self,
        hotel_id: str,
        department_id: str | None = None,
    ) -> Sequence[TicketCategory]:
        statement = select(TicketCategory).where(
            TicketCategory.hotel_id == hotel_id,
            TicketCategory.is_active.is_(True),
        )
        if department_id:
            statement = statement.where(TicketCategory.department_id == department_id)
        return self.db.execute(statement.order_by(TicketCategory.name)).scalars().all()

    def get_by_key(self, hotel_id: str, key: str | None) -> TicketCategory | None:
        if not key:
            return None
        return self.db.execute(
            select(TicketCategory).where(
                TicketCategory.hotel_id == hotel_id,
                TicketCategory.key == key,
                TicketCategory.is_active.is_(True),
            )
        ).scalar_one_or_none()

    def get_by_department_key(
        self,
        hotel_id: str,
        department_key: str,
        category_key: str,
    ) -> TicketCategory | None:
        return self.db.execute(
            select(TicketCategory)
            .join(Department, Department.id == TicketCategory.department_id)
            .where(
                TicketCategory.hotel_id == hotel_id,
                TicketCategory.key == category_key,
                TicketCategory.is_active.is_(True),
                Department.hotel_id == hotel_id,
                Department.key == department_key,
                Department.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.department import Department
from app.repositories.base import BaseRepository


class DepartmentRepository(BaseRepository[Department]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Department)

    def get_by_key(self, hotel_id: str, key: str) -> Department | None:
        return self.db.execute(
            select(Department).where(
                Department.hotel_id == hotel_id,
                Department.key == key,
                Department.is_active.is_(True),
            )
        ).scalar_one_or_none()

    def find_by_name(self, hotel_id: str, name: str) -> Department | None:
        return self.db.execute(
            select(Department).where(
                Department.hotel_id == hotel_id,
                Department.name == name,
                Department.is_active.is_(True),
            )
        ).scalar_one_or_none()

    def first_active(self, hotel_id: str) -> Department | None:
        return self.db.execute(
            select(Department)
            .where(Department.hotel_id == hotel_id, Department.is_active.is_(True))
            .order_by(Department.sort_order, Department.name)
        ).scalars().first()

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.task_type_sla import TaskTypeSLA
from app.repositories.base import BaseRepository


class TaskTypeSLARepository(BaseRepository[TaskTypeSLA]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, TaskTypeSLA)

    def list_for_department(self, hotel_id: str, department_id: str) -> Sequence[TaskTypeSLA]:
        return self.db.execute(
            select(TaskTypeSLA)
            .where(
                TaskTypeSLA.hotel_id == hotel_id,
                TaskTypeSLA.department_id == department_id,
                TaskTypeSLA.is_active.is_(True),
            )
            .order_by(TaskTypeSLA.task_category)
        ).scalars().all()

    def find(self, hotel_id: str, department_id: str | None, task_category: str | None) -> TaskTypeSLA | None:
        if not department_id or not task_category:
            return None
        return self.db.execute(
            select(TaskTypeSLA).where(
                TaskTypeSLA.hotel_id == hotel_id,
                TaskTypeSLA.department_id == department_id,
                TaskTypeSLA.task_category == task_category,
                TaskTypeSLA.is_active.is_(True),
            )
        ).scalar_one_or_none()

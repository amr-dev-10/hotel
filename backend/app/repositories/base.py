from collections.abc import Sequence
from typing import Generic, TypeVar

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

ModelT = TypeVar("ModelT")


class BaseRepository(Generic[ModelT]):
    def __init__(self, db: Session, model: type[ModelT]) -> None:
        self.db = db
        self.model = model

    def get(self, item_id: str) -> ModelT | None:
        return self.db.get(self.model, item_id)

    def get_for_hotel(self, hotel_id: str, item_id: str) -> ModelT | None:
        statement = select(self.model).where(
            self.model.id == item_id,
            self.model.hotel_id == hotel_id,
        )
        return self.db.execute(statement).scalar_one_or_none()

    def list_for_hotel(
        self,
        hotel_id: str,
        limit: int = 50,
        cursor: str | None = None,
    ) -> Sequence[ModelT]:
        statement: Select = select(self.model).where(self.model.hotel_id == hotel_id)
        if hasattr(self.model, "deleted_at"):
            statement = statement.where(self.model.deleted_at.is_(None))
        if cursor:
            statement = statement.where(self.model.id > cursor)
        statement = statement.order_by(self.model.id).limit(limit)
        return self.db.execute(statement).scalars().all()

    def add(self, instance: ModelT, commit: bool = True) -> ModelT:
        self.db.add(instance)
        if commit:
            self.db.commit()
            self.db.refresh(instance)
        return instance

    def commit(self, instance: ModelT | None = None) -> ModelT | None:
        self.db.commit()
        if instance is not None:
            self.db.refresh(instance)
        return instance

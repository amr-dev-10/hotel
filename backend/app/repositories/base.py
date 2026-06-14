from typing import Generic, TypeVar

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.database.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    def __init__(self, db: Session, model: type[ModelT], hotel_id: str) -> None:
        self.db = db
        self.model = model
        self.hotel_id = hotel_id

    def select_scoped(self) -> Select[tuple[ModelT]]:
        return select(self.model).where(self.model.hotel_id == self.hotel_id)

    def get_required(self, record_id: str) -> ModelT:
        row = self.db.scalar(self.select_scoped().where(self.model.id == record_id))
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"{self.model.__name__} not found")
        return row

    def add(self, row: ModelT) -> ModelT:
        if str(row.hotel_id) != self.hotel_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cross-hotel write rejected")
        self.db.add(row)
        return row

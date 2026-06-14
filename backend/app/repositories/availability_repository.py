from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.availability import RoomBlock
from app.repositories.base import BaseRepository


class RoomBlockRepository(BaseRepository[RoomBlock]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RoomBlock)

    def conflicts_for_room(
        self,
        hotel_id: str,
        room_id: str,
        start_date: date,
        end_date: date,
        ignore_reference_id: str | None = None,
    ) -> Sequence[RoomBlock]:
        statement = select(RoomBlock).where(
            RoomBlock.hotel_id == hotel_id,
            RoomBlock.room_id == room_id,
            RoomBlock.start_date < end_date,
            RoomBlock.end_date > start_date,
        )
        if ignore_reference_id:
            statement = statement.where(RoomBlock.reference_id != ignore_reference_id)
        return self.db.execute(statement).scalars().all()

    def overlaps_for_type(
        self,
        hotel_id: str,
        room_type_id: str,
        start_date: date,
        end_date: date,
    ) -> Sequence[RoomBlock]:
        return self.db.execute(
            select(RoomBlock).where(
                RoomBlock.hotel_id == hotel_id,
                RoomBlock.room_type_id == room_type_id,
                RoomBlock.start_date < end_date,
                RoomBlock.end_date > start_date,
            )
        ).scalars().all()

    def list_for_room_ids(
        self,
        hotel_id: str,
        room_ids: list[str],
        start_date: date,
        end_date: date,
    ) -> Sequence[RoomBlock]:
        if not room_ids:
            return []
        return self.db.execute(
            select(RoomBlock).where(
                RoomBlock.hotel_id == hotel_id,
                RoomBlock.room_id.in_(room_ids),
                RoomBlock.start_date < end_date,
                RoomBlock.end_date > start_date,
            )
        ).scalars().all()

    def list_by_reference(self, hotel_id: str, reference_type: str, reference_id: str) -> Sequence[RoomBlock]:
        return self.db.execute(
            select(RoomBlock).where(
                RoomBlock.hotel_id == hotel_id,
                RoomBlock.reference_type == reference_type,
                RoomBlock.reference_id == reference_id,
            )
        ).scalars().all()

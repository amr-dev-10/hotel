from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room
from app.repositories.base import BaseRepository


class RoomRepository(BaseRepository[Room]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Room)

    def get_by_number(self, hotel_id: str, room_number: str) -> Room | None:
        return self.db.execute(
            select(Room).where(
                Room.hotel_id == hotel_id,
                Room.room_number == room_number,
                Room.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

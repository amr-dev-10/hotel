from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.room import Room, RoomType
from app.repositories.base import BaseRepository


class RoomTypeRepository(BaseRepository[RoomType]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RoomType)

    def get_by_name(self, hotel_id: str, name: str) -> RoomType | None:
        return self.db.execute(
            select(RoomType).where(
                RoomType.hotel_id == hotel_id,
                RoomType.name == name,
                RoomType.deleted_at.is_(None),
            )
        ).scalar_one_or_none()

    def default_for_hotel(self, hotel_id: str) -> RoomType | None:
        return self.db.execute(
            select(RoomType)
            .where(
                RoomType.hotel_id == hotel_id,
                RoomType.is_active.is_(True),
                RoomType.deleted_at.is_(None),
            )
            .order_by(RoomType.sort_order, RoomType.name)
        ).scalars().first()


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

    def list_by_type(self, hotel_id: str, room_type_id: str) -> list[Room]:
        return list(
            self.db.execute(
                select(Room)
                .where(
                    Room.hotel_id == hotel_id,
                    Room.room_type_id == room_type_id,
                    Room.deleted_at.is_(None),
                )
                .order_by(Room.room_number)
            ).scalars().all()
        )

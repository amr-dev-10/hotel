from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.availability import RoomBlock
from app.models.base import utcnow
from app.models.room import Room
from app.repositories.availability_repository import RoomBlockRepository
from app.repositories.room_repository import RoomRepository, RoomTypeRepository
from app.schemas.availability import RoomBlockCreate


class AvailabilityService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.blocks = RoomBlockRepository(db)
        self.rooms = RoomRepository(db)
        self.room_types = RoomTypeRepository(db)

    def check_room_available(
        self,
        hotel_id: str,
        room_id: str,
        start_date: date,
        end_date: date,
        ignore_reference_id: str | None = None,
    ) -> bool:
        return not self.blocks.conflicts_for_room(
            hotel_id,
            room_id,
            start_date,
            end_date,
            ignore_reference_id=ignore_reference_id,
        )

    def find_available_rooms(
        self,
        hotel_id: str,
        room_type_id: str,
        start_date: date,
        end_date: date,
        count: int = 1,
    ) -> list[Room]:
        rooms = self.rooms.list_by_type(hotel_id, room_type_id)
        room_ids = [room.id for room in rooms]
        blocked_ids = {
            block.room_id
            for block in self.blocks.list_for_room_ids(hotel_id, room_ids, start_date, end_date)
            if block.room_id
        }
        available = [room for room in rooms if room.id not in blocked_ids and room.status != "maintenance"]
        return available[:count]

    def ensure_room_type_available(
        self,
        hotel_id: str,
        room_type_id: str,
        start_date: date,
        end_date: date,
        quantity: int,
    ) -> None:
        total_rooms = len(self.rooms.list_by_type(hotel_id, room_type_id))
        if total_rooms <= 0:
            raise not_found("No rooms exist for this room type")
        type_blocks = self.blocks.overlaps_for_type(hotel_id, room_type_id, start_date, end_date)
        specific_blocks = [
            block
            for block in self.blocks.list_for_room_ids(
                hotel_id,
                [room.id for room in self.rooms.list_by_type(hotel_id, room_type_id)],
                start_date,
                end_date,
            )
            if block.room_id
        ]
        held = len(type_blocks) + len({block.room_id for block in specific_blocks})
        if total_rooms - held < quantity:
            raise bad_request("No availability for requested room type and dates")

    def block_room(
        self,
        hotel_id: str,
        payload: RoomBlockCreate,
        actor_id: str | None,
        commit: bool = True,
    ) -> RoomBlock:
        if payload.end_date <= payload.start_date:
            raise bad_request("end_date must be after start_date")
        if not payload.room_id and not payload.room_type_id:
            raise bad_request("room_id or room_type_id is required")
        if payload.room_id:
            room = self.rooms.get_for_hotel(hotel_id, payload.room_id)
            if not room:
                raise not_found("Room not found")
            if not self.check_room_available(
                hotel_id,
                room.id,
                payload.start_date,
                payload.end_date,
                ignore_reference_id=payload.reference_id,
            ):
                raise bad_request("Room is already blocked for those dates")
        if payload.room_type_id and not self.room_types.get_for_hotel(hotel_id, payload.room_type_id):
            raise not_found("Room type not found")
        block = RoomBlock(
            hotel_id=hotel_id,
            room_id=payload.room_id,
            room_type_id=payload.room_type_id,
            start_date=payload.start_date,
            end_date=payload.end_date,
            block_type=payload.block_type,
            reference_type=payload.reference_type,
            reference_id=payload.reference_id,
            notes=payload.notes,
            created_by=actor_id,
            created_at=utcnow(),
        )
        self.db.add(block)
        self.db.flush()
        if commit:
            self.db.commit()
            self.db.refresh(block)
        return block

    def hold_room_type(
        self,
        hotel_id: str,
        room_type_id: str,
        quantity: int,
        start_date: date,
        end_date: date,
        reservation_id: str,
        actor_id: str | None,
    ) -> list[RoomBlock]:
        self.ensure_room_type_available(hotel_id, room_type_id, start_date, end_date, quantity)
        blocks = []
        for _ in range(quantity):
            blocks.append(
                self.block_room(
                    hotel_id,
                    RoomBlockCreate(
                        room_type_id=room_type_id,
                        start_date=start_date,
                        end_date=end_date,
                        block_type="reservation",
                        reference_type="reservation",
                        reference_id=reservation_id,
                    ),
                    actor_id,
                    commit=False,
                )
            )
        return blocks

    def release_by_reference(self, hotel_id: str, reference_type: str, reference_id: str) -> None:
        for block in self.blocks.list_by_reference(hotel_id, reference_type, reference_id):
            self.db.delete(block)
        self.db.flush()

    def get_availability_calendar(self, hotel_id: str, month: date) -> dict:
        first = month.replace(day=1)
        days = monthrange(first.year, first.month)[1]
        room_types = self.room_types.list_for_hotel(hotel_id, limit=500)
        calendar: dict[str, dict[str, dict[str, int]]] = {}
        for offset in range(days):
            current = first + timedelta(days=offset)
            day_key = current.isoformat()
            calendar[day_key] = {}
            for room_type in room_types:
                rooms = self.rooms.list_by_type(hotel_id, room_type.id)
                total = len(rooms)
                if not total:
                    continue
                next_day = current + timedelta(days=1)
                room_blocks = self.blocks.list_for_room_ids(
                    hotel_id,
                    [room.id for room in rooms],
                    current,
                    next_day,
                )
                type_blocks = self.blocks.overlaps_for_type(hotel_id, room_type.id, current, next_day)
                blocked = len({block.room_id for block in room_blocks if block.room_id}) + len(type_blocks)
                calendar[day_key][room_type.name] = {
                    "total": total,
                    "available": max(total - blocked, 0),
                }
        return calendar

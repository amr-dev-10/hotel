from datetime import date

from app.core.database import SessionLocal
from app.repositories.reservation_repository import ReservationRepository, StayRecordRepository
from app.repositories.room_repository import RoomRepository, RoomTypeRepository
from app.schemas.folio import FolioItemCreate
from app.services.folio_service import FolioService
from app.services.rate_plan_service import RatePlanService


def post_nightly_room_charges(target_date: date | None = None) -> int:
    target_date = target_date or date.today()
    db = SessionLocal()
    posted = 0
    try:
        stays = StayRecordRepository(db).list_active()
        rooms = RoomRepository(db)
        room_types = RoomTypeRepository(db)
        reservations = ReservationRepository(db)
        rate_plans = RatePlanService(db)
        folios = FolioService(db)
        for stay in stays:
            reservation = reservations.get_for_hotel(stay.hotel_id, stay.reservation_id)
            room = rooms.get_for_hotel(stay.hotel_id, stay.room_id) if stay.room_id else None
            room_type = room_types.get_for_hotel(stay.hotel_id, room.room_type_id) if room and room.room_type_id else None
            if not reservation or not room or not room_type:
                continue
            folio = folios.ensure_for_reservation(stay.hotel_id, reservation.id, commit=False)
            price = rate_plans.get_effective_rate(stay.hotel_id, reservation, room_type, target_date)
            folios.add_item(
                stay.hotel_id,
                folio.id,
                FolioItemCreate(
                    item_type="room",
                    description=f"Room {room.room_number} - {room_type.name}",
                    quantity=1,
                    unit_price=price,
                    date=target_date,
                ),
                posted_by=None,
            )
            posted += 1
        return posted
    finally:
        db.close()

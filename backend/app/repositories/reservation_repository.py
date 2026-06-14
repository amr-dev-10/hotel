from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.reservation import Reservation, StayRecord
from app.repositories.base import BaseRepository


class ReservationRepository(BaseRepository[Reservation]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Reservation)

    def get_by_no(self, hotel_id: str, reservation_no: str) -> Reservation | None:
        return self.db.execute(
            select(Reservation).where(
                Reservation.hotel_id == hotel_id,
                Reservation.reservation_no == reservation_no,
            )
        ).scalar_one_or_none()


class StayRecordRepository(BaseRepository[StayRecord]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, StayRecord)

    def get_for_reservation(self, hotel_id: str, reservation_id: str) -> StayRecord | None:
        return self.db.execute(
            select(StayRecord).where(
                StayRecord.hotel_id == hotel_id,
                StayRecord.reservation_id == reservation_id,
            )
        ).scalar_one_or_none()

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guest import Guest
from app.models.reservation import Reservation, ReservationGuest, ReservationRoomType, StayRecord
from app.models.room import Room
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

    def find_active_for_guest_room(
        self,
        hotel_id: str,
        room_number: str,
    ) -> list[tuple[Reservation, Guest, Room]]:
        return list(
            self.db.execute(
                select(Reservation, Guest, Room)
                .join(Guest, Guest.id == Reservation.guest_id)
                .join(Room, Room.id == Reservation.room_id)
                .where(
                    Reservation.hotel_id == hotel_id,
                    Reservation.deleted_at.is_(None),
                    Room.room_number == room_number,
                    Reservation.status.in_(("booked", "confirmed", "checked_in", "in_house")),
                )
                .order_by(Reservation.checkin_date.desc())
            ).all()
        )


class ReservationGuestRepository(BaseRepository[ReservationGuest]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ReservationGuest)

    def list_for_reservation(self, hotel_id: str, reservation_id: str) -> Sequence[ReservationGuest]:
        return self.db.execute(
            select(ReservationGuest)
            .where(
                ReservationGuest.hotel_id == hotel_id,
                ReservationGuest.reservation_id == reservation_id,
            )
            .order_by(ReservationGuest.is_primary.desc(), ReservationGuest.added_at)
        ).scalars().all()

    def get_primary(self, hotel_id: str, reservation_id: str) -> ReservationGuest | None:
        return self.db.execute(
            select(ReservationGuest)
            .where(
                ReservationGuest.hotel_id == hotel_id,
                ReservationGuest.reservation_id == reservation_id,
                ReservationGuest.is_primary.is_(True),
            )
        ).scalar_one_or_none()


class ReservationRoomTypeRepository(BaseRepository[ReservationRoomType]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ReservationRoomType)

    def list_for_reservation(self, hotel_id: str, reservation_id: str) -> Sequence[ReservationRoomType]:
        return self.db.execute(
            select(ReservationRoomType).where(
                ReservationRoomType.hotel_id == hotel_id,
                ReservationRoomType.reservation_id == reservation_id,
            )
        ).scalars().all()


class StayRecordRepository(BaseRepository[StayRecord]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, StayRecord)

    def get_for_reservation(self, hotel_id: str, reservation_id: str) -> StayRecord | None:
        return self.db.execute(
            select(StayRecord)
            .where(
                StayRecord.hotel_id == hotel_id,
                StayRecord.reservation_id == reservation_id,
            )
            .order_by(StayRecord.actual_checkin.desc().nullslast(), StayRecord.id.desc())
            .limit(1)
        ).scalar_one_or_none()

    def get_active_for_reservation(self, hotel_id: str, reservation_id: str) -> StayRecord | None:
        return self.db.execute(
            select(StayRecord)
            .where(
                StayRecord.hotel_id == hotel_id,
                StayRecord.reservation_id == reservation_id,
                StayRecord.actual_checkout.is_(None),
            )
            .order_by(StayRecord.actual_checkin.desc().nullslast(), StayRecord.id.desc())
            .limit(1)
        ).scalar_one_or_none()

    def list_for_reservation(self, hotel_id: str, reservation_id: str) -> Sequence[StayRecord]:
        return self.db.execute(
            select(StayRecord)
            .where(
                StayRecord.hotel_id == hotel_id,
                StayRecord.reservation_id == reservation_id,
            )
            .order_by(StayRecord.actual_checkin)
        ).scalars().all()

    def list_active(self, hotel_id: str | None = None) -> Sequence[StayRecord]:
        statement = select(StayRecord).where(StayRecord.actual_checkout.is_(None))
        if hotel_id:
            statement = statement.where(StayRecord.hotel_id == hotel_id)
        return self.db.execute(statement).scalars().all()

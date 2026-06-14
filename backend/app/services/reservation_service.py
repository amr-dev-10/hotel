from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.reservation import Reservation, StayRecord
from app.repositories.guest_repository import GuestRepository
from app.repositories.reservation_repository import ReservationRepository, StayRecordRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.reservation import ReservationCreate
from app.services.audit_service import AuditService


class ReservationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.reservations = ReservationRepository(db)
        self.stays = StayRecordRepository(db)
        self.guests = GuestRepository(db)
        self.rooms = RoomRepository(db)
        self.audit = AuditService(db)

    def create_reservation(
        self,
        hotel_id: str,
        payload: ReservationCreate,
        actor_id: str | None = None,
        commit: bool = True,
    ) -> Reservation:
        if payload.checkout_date <= payload.checkin_date:
            raise bad_request("checkout_date must be after checkin_date")
        if payload.room_id and not self.rooms.get_for_hotel(hotel_id, payload.room_id):
            raise not_found("Room not found")

        guest = Guest(
            hotel_id=hotel_id,
            room_id=payload.room_id,
            name=payload.guest_name,
            phone=payload.phone,
            whatsapp_phone=payload.whatsapp_phone,
            check_in_date=payload.checkin_date,
            check_out_date=payload.checkout_date,
            status="pre_arrival",
        )
        self.db.add(guest)
        self.db.flush()

        reservation = Reservation(
            hotel_id=hotel_id,
            reservation_no=self._reservation_no(),
            guest_id=guest.id,
            room_id=payload.room_id,
            status="confirmed",
            checkin_date=payload.checkin_date,
            checkout_date=payload.checkout_date,
            source=payload.source,
        )
        self.db.add(reservation)
        self.db.flush()
        self.audit.log(
            hotel_id,
            "reservation.created",
            "reservation",
            reservation.id,
            actor_id,
            {"reservation_no": reservation.reservation_no},
        )
        if commit:
            self.db.commit()
            self.db.refresh(reservation)
        return reservation

    def check_in(
        self,
        hotel_id: str,
        reservation_id: str,
        actor_id: str | None = None,
    ) -> Reservation:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        guest = self.guests.get_for_hotel(hotel_id, reservation.guest_id)
        if not guest:
            raise not_found("Guest not found")
        reservation.status = "checked_in"
        guest.status = "checked_in"
        guest.check_in_date = date.today()
        if reservation.room_id:
            room = self.rooms.get_for_hotel(hotel_id, reservation.room_id)
            if room:
                room.status = "occupied"
        stay = self.stays.get_for_reservation(hotel_id, reservation.id)
        if not stay:
            stay = StayRecord(
                hotel_id=hotel_id,
                reservation_id=reservation.id,
                room_id=reservation.room_id,
                actual_checkin=utcnow(),
            )
            self.db.add(stay)
        else:
            stay.actual_checkin = stay.actual_checkin or utcnow()
        self.audit.log(hotel_id, "reservation.checked_in", "reservation", reservation.id, actor_id)
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def check_out(
        self,
        hotel_id: str,
        reservation_id: str,
        actor_id: str | None = None,
    ) -> Reservation:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        guest = self.guests.get_for_hotel(hotel_id, reservation.guest_id)
        if guest:
            guest.status = "checked_out"
            guest.check_out_date = date.today()
        reservation.status = "checked_out"
        if reservation.room_id:
            room = self.rooms.get_for_hotel(hotel_id, reservation.room_id)
            if room:
                room.status = "available"
        stay = self.stays.get_for_reservation(hotel_id, reservation.id)
        if stay:
            stay.actual_checkout = utcnow()
        self.audit.log(hotel_id, "reservation.checked_out", "reservation", reservation.id, actor_id)
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def _reservation_no(self) -> str:
        return f"RES-{utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:4].upper()}"

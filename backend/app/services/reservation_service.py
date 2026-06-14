from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.reservation import Reservation, ReservationGuest, StayRecord
from app.repositories.guest_repository import GuestRepository
from app.repositories.rate_plan_repository import RatePlanRepository
from app.repositories.reservation_repository import (
    ReservationGuestRepository,
    ReservationRepository,
    StayRecordRepository,
)
from app.repositories.room_repository import RoomRepository
from app.repositories.whatsapp_session_repository import WhatsAppSessionRepository
from app.schemas.reservation import (
    ReservationCreate,
    ReservationGuestCreate,
    ReservationGuestNew,
    ReservationUpdate,
    RoomChangeRequest,
)
from app.services.audit_service import AuditService
from app.services.folio_service import FolioService
from app.services.pms_service import HousekeepingService


class ReservationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.reservations = ReservationRepository(db)
        self.reservation_guests = ReservationGuestRepository(db)
        self.stays = StayRecordRepository(db)
        self.guests = GuestRepository(db)
        self.rooms = RoomRepository(db)
        self.rate_plans = RatePlanRepository(db)
        self.sessions = WhatsAppSessionRepository(db)
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
        if payload.rate_plan_id and not self.rate_plans.get_for_hotel(hotel_id, payload.rate_plan_id):
            raise not_found("Rate plan not found")

        primary_guest_id = self._primary_guest_id(hotel_id, payload)
        if not primary_guest_id:
            if not payload.guest_name:
                raise bad_request("guest_name is required when guests list is empty")
            guest = Guest(
                hotel_id=hotel_id,
                name=payload.guest_name,
                phone=payload.phone,
                whatsapp_phone=payload.whatsapp_phone,
                check_in_date=payload.checkin_date,
                check_out_date=payload.checkout_date,
                status="pre_arrival",
            )
            self.db.add(guest)
            self.db.flush()
            primary_guest_id = guest.id

        reservation = Reservation(
            hotel_id=hotel_id,
            reservation_no=self._reservation_no(),
            guest_id=primary_guest_id,
            room_id=payload.room_id,
            rate_plan_id=payload.rate_plan_id,
            status="confirmed",
            checkin_date=payload.checkin_date,
            checkout_date=payload.checkout_date,
            source=payload.source,
            notes=payload.notes,
        )
        self.db.add(reservation)
        self.db.flush()
        self._sync_reservation_guests(hotel_id, reservation, payload)
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

    def update_reservation(
        self,
        hotel_id: str,
        reservation_id: str,
        payload: ReservationUpdate,
        actor_id: str | None = None,
    ) -> Reservation:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        old_payload = {
            "room_id": reservation.room_id,
            "rate_plan_id": reservation.rate_plan_id,
            "status": reservation.status,
            "checkin_date": str(reservation.checkin_date),
            "checkout_date": str(reservation.checkout_date),
            "source": reservation.source,
            "notes": reservation.notes,
        }
        if payload.room_id and not self.rooms.get_for_hotel(hotel_id, payload.room_id):
            raise not_found("Room not found")
        if payload.rate_plan_id and not self.rate_plans.get_for_hotel(hotel_id, payload.rate_plan_id):
            raise not_found("Rate plan not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(reservation, key, value)
        self.audit.log(
            hotel_id,
            "reservation.updated",
            "reservation",
            reservation.id,
            actor_id,
            old_payload=old_payload,
            new_payload=payload.model_dump(exclude_unset=True),
        )
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def add_guest(
        self,
        hotel_id: str,
        reservation_id: str,
        payload: ReservationGuestNew,
        actor_id: str | None = None,
    ) -> ReservationGuest:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        guest = Guest(
            hotel_id=hotel_id,
            name=payload.name,
            phone=payload.phone,
            whatsapp_phone=payload.whatsapp_phone,
            email=payload.email,
            check_in_date=reservation.checkin_date,
            check_out_date=reservation.checkout_date,
            status=reservation.status if reservation.status != "confirmed" else "pre_arrival",
        )
        self.db.add(guest)
        self.db.flush()
        link = self._add_reservation_guest(
            hotel_id,
            reservation.id,
            guest.id,
            payload.is_primary,
            payload.relationship,
        )
        if payload.is_primary:
            reservation.guest_id = guest.id
        self.audit.log(hotel_id, "reservation.guest.added", "reservation", reservation.id, actor_id)
        self.db.commit()
        self.db.refresh(link)
        return link

    def list_guests(self, hotel_id: str, reservation_id: str) -> list[ReservationGuest]:
        return list(self.reservation_guests.list_for_reservation(hotel_id, reservation_id))

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
        stay = self.stays.get_active_for_reservation(hotel_id, reservation.id)
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
        if guest.whatsapp_phone or guest.phone:
            session = self.sessions.get_or_create(
                hotel_id,
                guest.whatsapp_phone or guest.phone,
                None,
            )
            session.guest_id = guest.id
            session.room_id = reservation.room_id
            session.state = "active"
        FolioService(self.db).ensure_for_reservation(hotel_id, reservation.id, actor_id, commit=False)
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
        stay = self.stays.get_active_for_reservation(hotel_id, reservation.id)
        active_room_id = stay.room_id if stay else reservation.room_id
        if active_room_id:
            room = self.rooms.get_for_hotel(hotel_id, active_room_id)
            if room:
                room.status = "cleaning"
                HousekeepingService(self.db).create_checkout_clean(
                    hotel_id,
                    room.id,
                    actor_id,
                    commit=False,
                )
        if stay:
            stay.actual_checkout = utcnow()
        if guest and (guest.whatsapp_phone or guest.phone):
            session = self.sessions.get_by_phone(hotel_id, guest.whatsapp_phone or guest.phone)
            if session:
                session.state = "expired"
                session.expires_at = utcnow()
        FolioService(self.db).close(hotel_id, reservation.id, actor_id)
        self.audit.log(hotel_id, "reservation.checked_out", "reservation", reservation.id, actor_id)
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def change_room(
        self,
        hotel_id: str,
        reservation_id: str,
        payload: RoomChangeRequest,
        actor_id: str | None = None,
    ) -> Reservation:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        new_room = self.rooms.get_for_hotel(hotel_id, payload.new_room_id)
        if not new_room:
            raise not_found("New room not found")
        active_stay = self.stays.get_active_for_reservation(hotel_id, reservation.id)
        now = utcnow()
        old_room_id = active_stay.room_id if active_stay else reservation.room_id
        if active_stay:
            active_stay.actual_checkout = now
            active_stay.notes = payload.reason
        if old_room_id:
            old_room = self.rooms.get_for_hotel(hotel_id, old_room_id)
            if old_room:
                old_room.status = "available"
        new_room.status = "occupied"
        reservation.room_id = new_room.id
        self.db.add(
            StayRecord(
                hotel_id=hotel_id,
                reservation_id=reservation.id,
                room_id=new_room.id,
                actual_checkin=now,
                notes=payload.reason,
            )
        )
        guest = self.guests.get_for_hotel(hotel_id, reservation.guest_id)
        if guest and (guest.whatsapp_phone or guest.phone):
            session = self.sessions.get_by_phone(hotel_id, guest.whatsapp_phone or guest.phone)
            if session:
                session.room_id = new_room.id
        self.audit.log(
            hotel_id,
            "room.changed",
            "reservation",
            reservation.id,
            actor_id,
            {
                "old_room_id": old_room_id,
                "new_room_id": new_room.id,
                "reason": payload.reason,
            },
        )
        self.db.commit()
        self.db.refresh(reservation)
        return reservation

    def _reservation_no(self) -> str:
        return f"RES-{utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:4].upper()}"

    def _primary_guest_id(self, hotel_id: str, payload: ReservationCreate) -> str | None:
        if not payload.guests:
            return None
        primary = next((guest for guest in payload.guests if guest.is_primary), payload.guests[0])
        for guest_link in payload.guests:
            if not self.guests.get_for_hotel(hotel_id, guest_link.guest_id):
                raise not_found("Reservation guest not found")
        return primary.guest_id

    def _sync_reservation_guests(
        self,
        hotel_id: str,
        reservation: Reservation,
        payload: ReservationCreate,
    ) -> None:
        if payload.guests:
            has_primary = any(guest.is_primary for guest in payload.guests)
            for index, guest_link in enumerate(payload.guests):
                self._add_reservation_guest(
                    hotel_id,
                    reservation.id,
                    guest_link.guest_id,
                    guest_link.is_primary or (not has_primary and index == 0),
                    guest_link.relationship,
                )
            return
        self._add_reservation_guest(
            hotel_id,
            reservation.id,
            reservation.guest_id,
            True,
            "self",
        )

    def _add_reservation_guest(
        self,
        hotel_id: str,
        reservation_id: str,
        guest_id: str,
        is_primary: bool,
        relationship: str | None,
    ) -> ReservationGuest:
        if is_primary:
            for link in self.reservation_guests.list_for_reservation(hotel_id, reservation_id):
                link.is_primary = False
        link = ReservationGuest(
            hotel_id=hotel_id,
            reservation_id=reservation_id,
            guest_id=guest_id,
            is_primary=is_primary,
            relationship=relationship,
        )
        self.db.add(link)
        self.db.flush()
        return link

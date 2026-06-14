from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, not_found
from app.models.base import utcnow
from app.models.guest import Guest
from app.models.reservation import Reservation, ReservationGuest, ReservationRoomType, StayRecord
from app.repositories.guest_repository import GuestRepository
from app.repositories.rate_plan_repository import RatePlanRepository
from app.repositories.reservation_repository import (
    ReservationGuestRepository,
    ReservationRoomTypeRepository,
    ReservationRepository,
    StayRecordRepository,
)
from app.repositories.room_repository import RoomRepository, RoomTypeRepository
from app.repositories.whatsapp_session_repository import WhatsAppSessionRepository
from app.schemas.reservation import (
    ReservationCreate,
    ReservationCheckInRequest,
    ReservationGuestCreate,
    ReservationGuestNew,
    ReservationRoomTypeCreate,
    ReservationUpdate,
    RoomChangeRequest,
)
from app.services.audit_service import AuditService
from app.services.availability_service import AvailabilityService
from app.services.folio_service import FolioService
from app.services.pms_service import HousekeepingService


class ReservationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.reservations = ReservationRepository(db)
        self.reservation_guests = ReservationGuestRepository(db)
        self.reservation_room_types = ReservationRoomTypeRepository(db)
        self.stays = StayRecordRepository(db)
        self.guests = GuestRepository(db)
        self.rooms = RoomRepository(db)
        self.room_types = RoomTypeRepository(db)
        self.rate_plans = RatePlanRepository(db)
        self.sessions = WhatsAppSessionRepository(db)
        self.audit = AuditService(db)
        self.availability = AvailabilityService(db)

    def create_reservation(
        self,
        hotel_id: str,
        payload: ReservationCreate,
        actor_id: str | None = None,
        commit: bool = True,
    ) -> Reservation:
        if payload.checkout_date <= payload.checkin_date:
            raise bad_request("checkout_date must be after checkin_date")
        room_type_bookings = self._room_type_bookings(payload)
        room = None
        if payload.room_id:
            room = self.rooms.get_for_hotel(hotel_id, payload.room_id)
            if not room:
                raise not_found("Room not found")
            if not self.availability.check_room_available(
                hotel_id,
                room.id,
                payload.checkin_date,
                payload.checkout_date,
            ):
                raise bad_request("Room is not available for selected dates")
        if payload.rate_plan_id and not self.rate_plans.get_for_hotel(hotel_id, payload.rate_plan_id):
            raise not_found("Rate plan not found")
        for booking in room_type_bookings:
            if not self.room_types.get_for_hotel(hotel_id, booking.room_type_id):
                raise not_found("Room type not found")
            if booking.rate_plan_id and not self.rate_plans.get_for_hotel(hotel_id, booking.rate_plan_id):
                raise not_found("Rate plan not found")
            self.availability.ensure_room_type_available(
                hotel_id,
                booking.room_type_id,
                payload.checkin_date,
                payload.checkout_date,
                booking.quantity,
            )

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
        for booking in room_type_bookings:
            self._add_room_type_booking(hotel_id, reservation.id, booking)
            self.availability.hold_room_type(
                hotel_id,
                booking.room_type_id,
                booking.quantity,
                payload.checkin_date,
                payload.checkout_date,
                reservation.id,
                actor_id,
            )
        if room and not room_type_bookings:
            self.availability.block_room(
                hotel_id,
                self._room_block_payload(
                    room.id,
                    reservation.checkin_date,
                    reservation.checkout_date,
                    reservation.id,
                ),
                actor_id,
                commit=False,
            )
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
        payload: ReservationCheckInRequest | None = None,
    ) -> Reservation:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        guest = self.guests.get_for_hotel(hotel_id, reservation.guest_id)
        if not guest:
            raise not_found("Guest not found")
        payload = payload or ReservationCheckInRequest()
        assigned_room_ids = self._assign_room_types(hotel_id, reservation, payload, actor_id)
        reservation.status = "checked_in"
        guest.status = "checked_in"
        guest.check_in_date = date.today()
        if not assigned_room_ids and reservation.room_id:
            assigned_room_ids = [reservation.room_id]
        for room_id in assigned_room_ids:
            room = self.rooms.get_for_hotel(hotel_id, room_id)
            if room:
                room.status = "occupied"
        stay = self.stays.get_active_for_reservation(hotel_id, reservation.id)
        if not stay and assigned_room_ids:
            stay = StayRecord(
                hotel_id=hotel_id,
                reservation_id=reservation.id,
                room_id=assigned_room_ids[0],
                actual_checkin=utcnow(),
            )
            self.db.add(stay)
        else:
            if stay:
                stay.actual_checkin = stay.actual_checkin or utcnow()
        for extra_room_id in assigned_room_ids[1:]:
            self.db.add(
                StayRecord(
                    hotel_id=hotel_id,
                    reservation_id=reservation.id,
                    room_id=extra_room_id,
                    actual_checkin=utcnow(),
                )
            )
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
        self.availability.release_by_reference(hotel_id, "reservation", reservation.id)
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
        if not self.availability.check_room_available(
            hotel_id,
            new_room.id,
            reservation.checkin_date,
            reservation.checkout_date,
            ignore_reference_id=reservation.id,
        ):
            raise bad_request("New room is not available for this reservation")
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
        self.availability.release_by_reference(hotel_id, "reservation", reservation.id)
        self.availability.block_room(
            hotel_id,
            self._room_block_payload(
                new_room.id,
                reservation.checkin_date,
                reservation.checkout_date,
                reservation.id,
            ),
            actor_id,
            commit=False,
        )
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

    def _room_type_bookings(self, payload: ReservationCreate) -> list[ReservationRoomTypeCreate]:
        bookings = list(payload.room_types)
        if payload.room_type_id:
            bookings.append(
                ReservationRoomTypeCreate(
                    room_type_id=payload.room_type_id,
                    quantity=1,
                    rate_plan_id=payload.rate_plan_id,
                )
            )
        return bookings

    def _add_room_type_booking(
        self,
        hotel_id: str,
        reservation_id: str,
        booking: ReservationRoomTypeCreate,
    ) -> ReservationRoomType:
        row = ReservationRoomType(
            hotel_id=hotel_id,
            reservation_id=reservation_id,
            room_type_id=booking.room_type_id,
            quantity=booking.quantity,
            rate_plan_id=booking.rate_plan_id,
        )
        self.db.add(row)
        self.db.flush()
        return row

    def _assign_room_types(
        self,
        hotel_id: str,
        reservation: Reservation,
        payload: ReservationCheckInRequest,
        actor_id: str | None,
    ) -> list[str]:
        room_type_rows = self.reservation_room_types.list_for_reservation(hotel_id, reservation.id)
        if not room_type_rows:
            return []
        assignments = {item.reservation_room_type_id: item.room_id for item in payload.room_assignments}
        assigned_room_ids: list[str] = []
        self.availability.release_by_reference(hotel_id, "reservation", reservation.id)
        for row in room_type_rows:
            room_ids = []
            if row.id in assignments:
                room_ids = [assignments[row.id]]
            elif payload.auto_assign or not row.assigned_room_id:
                available = self.availability.find_available_rooms(
                    hotel_id,
                    row.room_type_id,
                    reservation.checkin_date,
                    reservation.checkout_date,
                    row.quantity,
                )
                if len(available) < row.quantity:
                    raise bad_request("Not enough available rooms to check in reservation")
                room_ids = [room.id for room in available]
            elif row.assigned_room_id:
                room_ids = [row.assigned_room_id]
            for room_id in room_ids:
                room = self.rooms.get_for_hotel(hotel_id, room_id)
                if not room:
                    raise not_found("Assigned room not found")
                if room.room_type_id != row.room_type_id:
                    raise bad_request("Assigned room does not match booked room type")
                if not self.availability.check_room_available(
                    hotel_id,
                    room.id,
                    reservation.checkin_date,
                    reservation.checkout_date,
                    ignore_reference_id=reservation.id,
                ):
                    raise bad_request("Assigned room is not available")
                row.assigned_room_id = room.id
                row.assigned_at = utcnow()
                reservation.room_id = reservation.room_id or room.id
                self.availability.block_room(
                    hotel_id,
                    self._room_block_payload(
                        room.id,
                        reservation.checkin_date,
                        reservation.checkout_date,
                        reservation.id,
                    ),
                    actor_id,
                    commit=False,
                )
                assigned_room_ids.append(room.id)
        return assigned_room_ids

    def _room_block_payload(self, room_id: str, start_date: date, end_date: date, reservation_id: str):
        from app.schemas.availability import RoomBlockCreate

        return RoomBlockCreate(
            room_id=room_id,
            start_date=start_date,
            end_date=end_date,
            block_type="reservation",
            reference_type="reservation",
            reference_id=reservation_id,
        )

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

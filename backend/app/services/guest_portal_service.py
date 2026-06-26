from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import forbidden, not_found
from app.core.security import create_access_token, decode_access_token
from app.models.guest import Guest, GuestPortalToken
from app.models.reservation import Reservation
from app.models.room import Room
from app.repositories.guest_repository import GuestRepository
from app.repositories.reservation_repository import ReservationRepository
from app.repositories.room_repository import RoomRepository
from app.schemas.guest import GuestRead
from app.schemas.guest_portal import GuestPortalProfile, GuestPortalSessionRead
from app.schemas.reservation import ReservationRead


@dataclass(frozen=True)
class GuestPortalContext:
    hotel_id: str
    guest_id: str
    reservation_id: str
    room_id: str | None


class GuestPortalService:
    session_minutes = 60 * 24 * 7
    link_minutes = 60 * 48

    def __init__(self, db: Session) -> None:
        self.db = db
        self.guests = GuestRepository(db)
        self.reservations = ReservationRepository(db)
        self.rooms = RoomRepository(db)

    def login(self, hotel_id: str, phone: str, room_number: str) -> GuestPortalSessionRead:
        rows = self.reservations.find_active_for_guest_room(hotel_id, room_number.strip())
        phone_key = self._normalize_phone(phone)
        for reservation, guest, room in rows:
            if self._phone_matches(phone_key, guest):
                return self._issue_session(guest, reservation, room)
        raise forbidden("No active guest stay matches this phone and room")

    def create_link_token(
        self,
        hotel_id: str,
        guest_id: str,
        reservation_id: str,
        room_id: str | None,
    ) -> str:
        expires_delta = timedelta(minutes=self.link_minutes)
        token = create_access_token(
            guest_id,
            hotel_id,
            {
                "scope": "guest_portal_link",
                "guest_id": guest_id,
                "reservation_id": reservation_id,
                "room_id": room_id,
                "jti": uuid4().hex,
            },
            expires_delta=expires_delta,
        )
        token_row = GuestPortalToken(
            hotel_id=hotel_id,
            guest_id=guest_id,
            reservation_id=reservation_id,
            room_id=room_id,
            token_hash=self._token_hash(token),
            expires_at=datetime.now(UTC) + expires_delta,
        )
        self.db.add(token_row)
        self.db.commit()
        return token

    def verify_link_token(self, token: str) -> GuestPortalSessionRead:
        payload = decode_access_token(token)
        if payload.get("scope") not in {"guest_portal_link", "guest_portal"}:
            raise forbidden("Guest portal token required")

        if payload.get("scope") == "guest_portal_link":
            token_row = self.db.execute(
                select(GuestPortalToken).where(
                    GuestPortalToken.token_hash == self._token_hash(token),
                    GuestPortalToken.is_active.is_(True),
                    GuestPortalToken.expires_at >= datetime.now(UTC),
                )
            ).scalar_one_or_none()
            if not token_row:
                raise forbidden("Guest portal link is invalid or expired")

        guest = self._get_guest(str(payload.get("hotel_id")), str(payload.get("guest_id") or payload.get("sub")))
        reservation = self._get_reservation(str(payload.get("hotel_id")), str(payload.get("reservation_id")))
        room = self.rooms.get_for_hotel(reservation.hotel_id, reservation.room_id) if reservation.room_id else None
        return self._issue_session(guest, reservation, room)

    def context_from_token(self, token: str) -> GuestPortalContext:
        payload = decode_access_token(token)
        if payload.get("scope") != "guest_portal":
            raise forbidden("Guest portal session required")
        hotel_id = str(payload.get("hotel_id"))
        guest_id = str(payload.get("guest_id") or payload.get("sub"))
        reservation_id = str(payload.get("reservation_id"))
        room_id = payload.get("room_id")
        self._get_guest(hotel_id, guest_id)
        self._get_reservation(hotel_id, reservation_id)
        return GuestPortalContext(
            hotel_id=hotel_id,
            guest_id=guest_id,
            reservation_id=reservation_id,
            room_id=str(room_id) if room_id else None,
        )

    def profile(self, context: GuestPortalContext) -> GuestPortalProfile:
        guest = self._get_guest(context.hotel_id, context.guest_id)
        reservation = self._get_reservation(context.hotel_id, context.reservation_id)
        room = self.rooms.get_for_hotel(context.hotel_id, reservation.room_id) if reservation.room_id else None
        return GuestPortalProfile(
            guest=GuestRead.model_validate(guest),
            reservation=ReservationRead.model_validate(reservation),
            room_number=room.room_number if room else None,
        )

    def _issue_session(
        self,
        guest: Guest,
        reservation: Reservation,
        room: Room | None,
    ) -> GuestPortalSessionRead:
        token = create_access_token(
            guest.id,
            guest.hotel_id,
            {
                "scope": "guest_portal",
                "guest_id": guest.id,
                "reservation_id": reservation.id,
                "room_id": reservation.room_id,
            },
            expires_delta=timedelta(minutes=self.session_minutes),
        )
        profile = GuestPortalProfile(
            guest=GuestRead.model_validate(guest),
            reservation=ReservationRead.model_validate(reservation),
            room_number=room.room_number if room else None,
        )
        return GuestPortalSessionRead(
            access_token=token,
            expires_in_minutes=self.session_minutes,
            profile=profile,
        )

    def _get_guest(self, hotel_id: str, guest_id: str) -> Guest:
        guest = self.guests.get_for_hotel(hotel_id, guest_id)
        if not guest:
            raise not_found("Guest not found")
        return guest

    def _get_reservation(self, hotel_id: str, reservation_id: str) -> Reservation:
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        return reservation

    def _normalize_phone(self, value: str | None) -> str:
        return "".join(char for char in (value or "") if char.isdigit())

    def _phone_matches(self, phone_key: str, guest: Guest) -> bool:
        candidates = [self._normalize_phone(guest.phone), self._normalize_phone(guest.whatsapp_phone)]
        return any(candidate and (candidate == phone_key or candidate.endswith(phone_key[-10:])) for candidate in candidates)

    def _token_hash(self, token: str) -> str:
        return sha256(token.encode("utf-8")).hexdigest()

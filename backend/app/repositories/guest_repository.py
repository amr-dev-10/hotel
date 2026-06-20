from collections.abc import Sequence
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.guest import Guest, GuestConsent
from app.repositories.base import BaseRepository


class GuestRepository(BaseRepository[Guest]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Guest)

    def find_active_by_phone(self, hotel_id: str, phone: str) -> Guest | None:
        today = date.today()
        return self.db.execute(
            select(Guest).where(
                Guest.hotel_id == hotel_id,
                or_(Guest.phone == phone, Guest.whatsapp_phone == phone),
                Guest.status == "checked_in",
                or_(Guest.check_out_date.is_(None), Guest.check_out_date >= today),
            )
        ).scalar_one_or_none()

    def find_by_phone(self, hotel_id: str, phone: str) -> Guest | None:
        return self.db.execute(
            select(Guest).where(
                Guest.hotel_id == hotel_id,
                or_(Guest.phone == phone, Guest.whatsapp_phone == phone),
            ).order_by(Guest.created_at.desc())
        ).scalars().first()

    def list_active(self, hotel_id: str) -> Sequence[Guest]:
        return self.db.execute(
            select(Guest).where(
                Guest.hotel_id == hotel_id,
                Guest.status == "checked_in",
            )
        ).scalars().all()


class GuestConsentRepository(BaseRepository[GuestConsent]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, GuestConsent)

    def get_for_guest(self, hotel_id: str, guest_id: str) -> GuestConsent | None:
        return self.db.execute(
            select(GuestConsent).where(
                GuestConsent.hotel_id == hotel_id,
                GuestConsent.guest_id == guest_id,
            )
        ).scalar_one_or_none()

from collections.abc import Sequence
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.guest import Guest, GuestConsent
from app.repositories.base import BaseRepository
from app.repositories.pagination import CursorResult, apply_created_at_cursor, paginate_created_at_desc


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

    def find_by_phone_for_hotel(self, hotel_id: str, phone: str) -> Guest | None:
        """Find most recent guest by phone or whatsapp_phone — used at reservation creation."""
        if not phone:
            return None
        return self.find_by_phone(hotel_id, phone)

    def list_active(self, hotel_id: str) -> Sequence[Guest]:
        return self.db.execute(
            select(Guest).where(
                Guest.hotel_id == hotel_id,
                Guest.status == "checked_in",
            )
        ).scalars().all()

    def list_filtered(
        self,
        hotel_id: str,
        q: str | None = None,
        status: str | None = None,
        limit: int = 50,
        cursor: str | None = None,
    ) -> CursorResult[Guest]:
        statement = self._filtered_statement(hotel_id, q=q, status=status)
        statement = apply_created_at_cursor(statement, Guest, cursor)
        rows = (
            self.db.execute(
                statement.order_by(Guest.created_at.desc(), Guest.id.desc()).limit(limit + 1)
            )
            .scalars()
            .all()
        )
        return paginate_created_at_desc(rows, limit)

    def count_filtered(
        self,
        hotel_id: str,
        q: str | None = None,
        status: str | None = None,
    ) -> int:
        statement = self._filtered_statement(hotel_id, q=q, status=status)
        return self.db.execute(
            select(func.count()).select_from(statement.order_by(None).subquery())
        ).scalar_one()

    def _filtered_statement(
        self,
        hotel_id: str,
        q: str | None = None,
        status: str | None = None,
    ):
        statement = select(Guest).where(
            Guest.hotel_id == hotel_id,
            Guest.deleted_at.is_(None),
        )
        if status:
            statement = statement.where(Guest.status == status)
        if q:
            pattern = f"%{q.strip()}%"
            statement = statement.where(
                or_(
                    Guest.name.ilike(pattern),
                    Guest.phone.ilike(pattern),
                    Guest.whatsapp_phone.ilike(pattern),
                    Guest.email.ilike(pattern),
                    Guest.id.ilike(pattern),
                )
            )
        return statement


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

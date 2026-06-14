from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hotel import Hotel
from app.repositories.base import BaseRepository


class HotelRepository(BaseRepository[Hotel]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Hotel)

    def get_by_slug(self, slug: str) -> Hotel | None:
        return self.db.execute(select(Hotel).where(Hotel.slug == slug)).scalar_one_or_none()

    def get_by_phone_number_id(self, phone_number_id: str) -> Hotel | None:
        return self.db.execute(
            select(Hotel).where(Hotel.whatsapp_phone_number_id == phone_number_id)
        ).scalar_one_or_none()

    def first_active(self) -> Hotel | None:
        return self.db.execute(
            select(Hotel).where(Hotel.status == "active").order_by(Hotel.created_at)
        ).scalars().first()

    def list_active(self, limit: int = 50) -> Sequence[Hotel]:
        return self.db.execute(
            select(Hotel).where(Hotel.status == "active").order_by(Hotel.created_at).limit(limit)
        ).scalars().all()

from collections.abc import Sequence

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from app.models.hotel import Hotel
from app.models.organization import Organization, OrganizationHotel, OrganizationUser
from app.repositories.base import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Organization)

    def get_by_slug(self, slug: str) -> Organization | None:
        return self.db.execute(
            select(Organization).where(Organization.slug == slug)
        ).scalar_one_or_none()


class OrganizationHotelRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, organization_id: str, hotel_id: str, role: str) -> None:
        exists = self.db.execute(
            select(OrganizationHotel).where(
                OrganizationHotel.organization_id == organization_id,
                OrganizationHotel.hotel_id == hotel_id,
            )
        ).scalar_one_or_none()
        if not exists:
            self.db.execute(
                insert(OrganizationHotel).values(
                    organization_id=organization_id,
                    hotel_id=hotel_id,
                    role=role,
                )
            )

    def list_hotels(self, organization_id: str) -> Sequence[tuple[OrganizationHotel, Hotel]]:
        return self.db.execute(
            select(OrganizationHotel, Hotel)
            .join(Hotel, Hotel.id == OrganizationHotel.hotel_id)
            .where(OrganizationHotel.organization_id == organization_id)
            .order_by(Hotel.name)
        ).all()


class OrganizationUserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def add(self, organization_id: str, user_id: str, org_role: str) -> None:
        exists = self.get(organization_id, user_id)
        if not exists:
            self.db.execute(
                insert(OrganizationUser).values(
                    organization_id=organization_id,
                    user_id=user_id,
                    org_role=org_role,
                )
            )

    def get(self, organization_id: str, user_id: str) -> OrganizationUser | None:
        return self.db.execute(
            select(OrganizationUser).where(
                OrganizationUser.organization_id == organization_id,
                OrganizationUser.user_id == user_id,
            )
        ).scalar_one_or_none()

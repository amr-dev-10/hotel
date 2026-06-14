from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, forbidden, not_found
from app.models.organization import Organization
from app.models.user import User
from app.repositories.hotel_repository import HotelRepository
from app.repositories.organization_repository import (
    OrganizationHotelRepository,
    OrganizationRepository,
    OrganizationUserRepository,
)
from app.schemas.organization import OrganizationCreate, OrganizationHotelAdd
from app.services.analytics_service import AnalyticsService
from app.services.audit_service import AuditService


class OrganizationService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.organizations = OrganizationRepository(db)
        self.org_hotels = OrganizationHotelRepository(db)
        self.org_users = OrganizationUserRepository(db)
        self.hotels = HotelRepository(db)

    def create(self, payload: OrganizationCreate, current_user: User) -> Organization:
        if self.organizations.get_by_slug(payload.slug):
            raise bad_request("Organization slug already exists")
        organization = Organization(**payload.model_dump())
        self.db.add(organization)
        self.db.flush()
        self.org_users.add(organization.id, current_user.id, "org_admin")
        self.org_hotels.add(organization.id, current_user.hotel_id, "owner")
        AuditService(self.db).log(
            current_user.hotel_id,
            "organization.created",
            "organization",
            organization.id,
            current_user.id,
        )
        self.db.commit()
        self.db.refresh(organization)
        return organization

    def require_admin(self, organization_id: str, user: User) -> None:
        membership = self.org_users.get(organization_id, user.id)
        if not membership or membership.org_role != "org_admin":
            raise forbidden("Organization admin access required")

    def list_hotels(self, organization_id: str, user: User) -> list[dict]:
        self.require_admin(organization_id, user)
        rows = self.org_hotels.list_hotels(organization_id)
        return [
            {
                "organization_id": org_hotel.organization_id,
                "hotel_id": org_hotel.hotel_id,
                "role": org_hotel.role,
                "hotel": hotel,
            }
            for org_hotel, hotel in rows
        ]

    def add_hotel(
        self,
        organization_id: str,
        payload: OrganizationHotelAdd,
        user: User,
    ) -> dict:
        self.require_admin(organization_id, user)
        hotel = self.hotels.get(payload.hotel_id)
        if not hotel:
            raise not_found("Hotel not found")
        self.org_hotels.add(organization_id, payload.hotel_id, payload.role)
        self.db.commit()
        return {"organization_id": organization_id, "hotel_id": payload.hotel_id, "role": payload.role}

    def analytics(self, organization_id: str, user: User) -> dict:
        self.require_admin(organization_id, user)
        hotels = self.list_hotels(organization_id, user)
        totals = {
            "hotel_count": len(hotels),
            "total_rooms": 0,
            "occupied_rooms": 0,
            "revenue_total": 0.0,
        }
        analytics = AnalyticsService(self.db)
        from datetime import date

        for row in hotels:
            snapshot = analytics.generate_daily_snapshot(row["hotel_id"], date.today())
            totals["total_rooms"] += snapshot.total_rooms
            totals["occupied_rooms"] += snapshot.occupied_rooms
            totals["revenue_total"] += float(snapshot.revenue_total)
        return totals

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.schemas.hotel import HotelRead
from app.schemas.organization import OrganizationCreate, OrganizationHotelAdd, OrganizationRead
from app.services.organization_service import OrganizationService

router = APIRouter()


@router.post("")
def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    organization = OrganizationService(db).create(payload, current_user)
    return ok(OrganizationRead.model_validate(organization).model_dump())


@router.get("/{organization_id}/hotels")
def list_organization_hotels(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    rows = OrganizationService(db).list_hotels(organization_id, current_user)
    return ok(
        [
            {
                "organization_id": row["organization_id"],
                "hotel_id": row["hotel_id"],
                "role": row["role"],
                "hotel": HotelRead.model_validate(row["hotel"]).model_dump(),
            }
            for row in rows
        ]
    )


@router.post("/{organization_id}/hotels")
def add_organization_hotel(
    organization_id: str,
    payload: OrganizationHotelAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return ok(OrganizationService(db).add_hotel(organization_id, payload, current_user))


@router.get("/{organization_id}/analytics")
def organization_analytics(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return ok(OrganizationService(db).analytics(organization_id, current_user))

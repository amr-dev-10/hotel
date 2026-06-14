from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db
from app.core.exceptions import not_found
from app.core.responses import ok
from app.models.user import User
from app.repositories.hotel_repository import HotelRepository
from app.schemas.auth import CurrentUserRead
from app.schemas.hotel import HotelBootstrapRequest, HotelRead
from app.services.hotel_service import HotelService

router = APIRouter()


@router.post("/bootstrap")
def bootstrap_hotel(payload: HotelBootstrapRequest, db: Session = Depends(get_db)) -> dict:
    result = HotelService(db).bootstrap(payload)
    return ok(
        {
            "hotel": HotelRead.model_validate(result["hotel"]).model_dump(),
            "owner": CurrentUserRead.model_validate(result["owner"]).model_dump(),
            "access_token": result["access_token"],
            "refresh_token": result.get("refresh_token"),
            "token_type": result["token_type"],
        }
    )


@router.get("/{hotel_id}")
def get_hotel(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    hotel = HotelRepository(db).get(hotel_id)
    if not hotel:
        raise not_found("Hotel not found")
    return ok(HotelRead.model_validate(hotel).model_dump())

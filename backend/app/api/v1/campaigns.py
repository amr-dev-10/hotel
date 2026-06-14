from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.campaign_repository import CampaignRepository
from app.schemas.campaign import CampaignCreate, CampaignRead
from app.services.campaign_service import CampaignService

router = APIRouter()


@router.get("")
def list_campaigns(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.view")),
) -> dict:
    campaigns = CampaignRepository(db).list_for_hotel(hotel_id)
    return ok([CampaignRead.model_validate(item).model_dump() for item in campaigns])


@router.post("")
def create_campaign(
    hotel_id: str,
    payload: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.create")),
) -> dict:
    campaign = CampaignService(db).create_campaign(
        hotel_id,
        payload,
        created_by=current_user.id,
    )
    return ok(CampaignRead.model_validate(campaign).model_dump())


@router.post("/{campaign_id}/send")
def send_campaign(
    hotel_id: str,
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.send")),
) -> dict:
    campaign = CampaignService(db).send_campaign(hotel_id, campaign_id)
    return ok(CampaignRead.model_validate(campaign).model_dump())


@router.get("/{campaign_id}/stats")
def campaign_stats(
    hotel_id: str,
    campaign_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("campaign.view")),
) -> dict:
    return ok(CampaignService(db).stats(hotel_id, campaign_id))

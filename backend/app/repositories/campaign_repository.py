from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignDelivery
from app.repositories.base import BaseRepository


class CampaignRepository(BaseRepository[Campaign]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Campaign)

    def list_deliveries(self, campaign_id: str) -> Sequence[CampaignDelivery]:
        return self.db.execute(
            select(CampaignDelivery).where(CampaignDelivery.campaign_id == campaign_id)
        ).scalars().all()

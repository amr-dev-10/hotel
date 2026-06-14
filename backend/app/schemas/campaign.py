from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CampaignCreate(BaseModel):
    name: str | None = None
    template_name: str = Field(min_length=2, max_length=100)
    target_type: str = "all_active_guests"
    target_filter: dict = Field(default_factory=dict)
    target_guest_id: str | None = None
    scheduled_at: datetime | None = None
    params: dict = Field(default_factory=dict)


class CampaignRead(ORMModel):
    id: str
    hotel_id: str
    name: str | None = None
    template_name: str
    target_type: str
    target_guest_id: str | None = None
    target_filter: dict
    params: dict
    status: str
    scheduled_at: datetime | None = None
    sent_count: int
    delivered_count: int
    read_count: int
    failed_count: int
    created_by: str | None = None


class CampaignDeliveryRead(ORMModel):
    id: str
    hotel_id: str
    campaign_id: str
    guest_id: str | None = None
    phone: str
    status: str
    sent_at: datetime | None = None
    delivered_at: datetime | None = None
    read_at: datetime | None = None
    error_detail: str | None = None

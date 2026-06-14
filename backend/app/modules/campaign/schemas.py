from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


CampaignTarget = Literal["all_active_guests", "all_guests", "specific", "checked_in_today"]


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    template_name: str = Field(min_length=1, max_length=100)
    language_code: str = Field(default="en", max_length=16)
    target_type: CampaignTarget = "all_active_guests"
    target_guest_id: str | None = None
    scheduled_at: datetime | None = None
    params: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_target(self) -> "CampaignCreate":
        if self.target_type == "specific" and not self.target_guest_id:
            raise ValueError("target_guest_id is required when target_type is specific")
        return self


class CampaignRead(BaseModel):
    id: str
    hotel_id: str
    name: str
    template_name: str
    language_code: str
    target_type: str
    target_guest_id: str | None
    params: dict[str, Any]
    status: str
    scheduled_at: datetime | None
    sent_count: int
    delivery_count: int = 0


class CampaignDeliveryRead(BaseModel):
    id: str
    hotel_id: str
    campaign_id: str
    guest_id: str | None
    phone: str
    status: str
    sent_at: datetime | None
    delivered_at: datetime | None
    read_at: datetime | None
    error: str | None

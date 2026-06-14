from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignDelivery
from app.repositories.campaign_repository import CampaignRepository
from app.repositories.guest_repository import GuestRepository
from app.repositories.hotel_repository import HotelRepository
from app.repositories.whatsapp_repository import WhatsAppAccountRepository
from app.schemas.campaign import CampaignCreate
from app.services.whatsapp_service import WhatsAppService


class CampaignService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.campaigns = CampaignRepository(db)
        self.guests = GuestRepository(db)
        self.hotels = HotelRepository(db)
        self.whatsapp_accounts = WhatsAppAccountRepository(db)
        self.whatsapp = WhatsAppService()

    def create_campaign(
        self,
        hotel_id: str,
        payload: CampaignCreate,
        created_by: str | None,
    ) -> Campaign:
        campaign = Campaign(
            hotel_id=hotel_id,
            name=payload.name,
            template_name=payload.template_name,
            target_type=payload.target_type,
            target_guest_id=payload.target_guest_id,
            params=payload.params,
            scheduled_at=payload.scheduled_at,
            created_by=created_by,
            status="scheduled" if self._is_future(payload.scheduled_at) else "sending",
        )
        self.db.add(campaign)
        self.db.flush()

        recipients = self._recipients(hotel_id, payload)
        sent_count = 0
        hotel = self.hotels.get(hotel_id)
        account = None
        if hotel and hotel.whatsapp_phone_number_id:
            account = self.whatsapp_accounts.get_by_phone_number_id(hotel.whatsapp_phone_number_id)
        for guest in recipients:
            phone = guest.whatsapp_phone or guest.phone
            if not phone:
                continue
            delivery = CampaignDelivery(
                hotel_id=hotel_id,
                campaign_id=campaign.id,
                guest_id=guest.id,
                phone=phone,
                status="queued" if campaign.status == "scheduled" else "sent",
            )
            if campaign.status != "scheduled":
                self.whatsapp.send_template(
                    account.phone_number_id if account else (hotel.whatsapp_phone_number_id if hotel else None),
                    phone,
                    payload.template_name,
                    self._template_params(guest.name, payload.params),
                    access_token=account.access_token if account else None,
                )
                delivery.sent_at = datetime.now(UTC)
                sent_count += 1
            self.db.add(delivery)

        campaign.sent_count = sent_count
        if campaign.status == "sending":
            campaign.status = "sent"
        self.db.commit()
        self.db.refresh(campaign)
        return campaign

    def _recipients(self, hotel_id: str, payload: CampaignCreate) -> list[Any]:
        if payload.target_type == "specific" and payload.target_guest_id:
            guest = self.guests.get_for_hotel(hotel_id, payload.target_guest_id)
            return [guest] if guest else []
        return list(self.guests.list_active(hotel_id))

    def _template_params(self, guest_name: str, params: dict[str, Any]) -> list[str]:
        values = [guest_name]
        for key in sorted(params):
            values.append(str(params[key]))
        return values

    def _is_future(self, value: datetime | None) -> bool:
        if value is None:
            return False
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value > datetime.now(UTC)

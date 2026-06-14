import asyncio
from datetime import datetime, timezone

from sqlalchemy import select

from app.database.session import SessionLocal
from app.jobs.celery_app import celery_app
from app.modules.campaign.models import Campaign, CampaignDelivery
from app.modules.guest.models import Guest
from app.modules.tenant.models import Tenant
from app.services.whatsapp_service import WhatsAppService


@celery_app.task(name="workers.send_whatsapp_campaign")
def send_whatsapp_campaign(campaign_id: str) -> dict[str, int]:
    return asyncio.run(_send_whatsapp_campaign(campaign_id))


async def _send_whatsapp_campaign(campaign_id: str) -> dict[str, int]:
    sent = 0
    failed = 0
    db = SessionLocal()
    try:
        campaign = db.scalar(select(Campaign).where(Campaign.id == campaign_id))
        if campaign is None:
            return {"sent": sent, "failed": failed}

        hotel = db.scalar(select(Tenant).where(Tenant.id == campaign.tenant_id))
        if hotel is None or not hotel.whatsapp_phone_number_id:
            return {"sent": sent, "failed": failed}

        campaign.status = "sending"
        deliveries = db.scalars(
            select(CampaignDelivery).where(
                CampaignDelivery.campaign_id == campaign.id,
                CampaignDelivery.status == "queued",
            )
        ).all()
        service = WhatsAppService()
        for delivery in deliveries:
            guest = db.scalar(select(Guest).where(Guest.id == delivery.guest_id)) if delivery.guest_id else None
            params = _template_parameters(campaign.params, guest, hotel.name)
            try:
                await service.send_template(
                    hotel.whatsapp_phone_number_id,
                    delivery.phone,
                    campaign.template_name,
                    params,
                    campaign.language_code,
                )
                delivery.status = "sent"
                delivery.sent_at = datetime.now(timezone.utc)
                sent += 1
            except Exception as exc:  # Celery records aggregate status; delivery keeps the API/client error.
                delivery.status = "failed"
                delivery.error = str(exc)
                failed += 1

        campaign.sent_count += sent
        campaign.status = "sent" if failed == 0 else "partial"
        db.commit()
        return {"sent": sent, "failed": failed}
    finally:
        db.close()


def _template_parameters(params: dict, guest: Guest | None, hotel_name: str) -> list[str]:
    values = {
        "guest_name": guest.name if guest is not None else "Guest",
        "hotel_name": hotel_name,
        **{key: str(value) for key, value in params.items()},
    }
    ordered_keys = params.get("_order") if isinstance(params.get("_order"), list) else None
    if ordered_keys:
        return [str(values.get(key, "")) for key in ordered_keys]
    return [str(value) for key, value in values.items() if key != "_order"]

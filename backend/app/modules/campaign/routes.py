from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.campaign.models import Campaign, CampaignDelivery
from app.modules.campaign.schemas import CampaignCreate, CampaignDeliveryRead, CampaignRead
from app.modules.guest.models import Guest
from app.modules.hotel.dependencies import ensure_hotel_scope

router = APIRouter(prefix="/hotels/{hotel_id}/campaigns", tags=["campaigns"])


def _campaign_to_read(db: Session, campaign: Campaign) -> CampaignRead:
    delivery_count = (
        db.scalar(
            select(func.count())
            .select_from(CampaignDelivery)
            .where(CampaignDelivery.tenant_id == campaign.tenant_id, CampaignDelivery.campaign_id == campaign.id)
        )
        or 0
    )
    return CampaignRead(
        id=campaign.id,
        hotel_id=campaign.tenant_id,
        name=campaign.name,
        template_name=campaign.template_name,
        language_code=campaign.language_code,
        target_type=campaign.target_type,
        target_guest_id=campaign.target_guest_id,
        params=campaign.params,
        status=campaign.status,
        scheduled_at=campaign.scheduled_at,
        sent_count=campaign.sent_count,
        delivery_count=delivery_count,
    )


def _delivery_to_read(delivery: CampaignDelivery) -> CampaignDeliveryRead:
    return CampaignDeliveryRead(
        id=delivery.id,
        hotel_id=delivery.tenant_id,
        campaign_id=delivery.campaign_id,
        guest_id=delivery.guest_id,
        phone=delivery.phone,
        status=delivery.status,
        sent_at=delivery.sent_at,
        delivered_at=delivery.delivered_at,
        read_at=delivery.read_at,
        error=delivery.error,
    )


def _target_guests(db: Session, hotel_id: str, payload: CampaignCreate) -> list[Guest]:
    statement = select(Guest).where(Guest.tenant_id == hotel_id)
    if payload.target_type == "specific":
        statement = statement.where(Guest.id == payload.target_guest_id)
    elif payload.target_type == "all_active_guests":
        statement = statement.where(Guest.status == "checked_in")
    elif payload.target_type == "checked_in_today":
        today = datetime.now(timezone.utc).date().isoformat()
        statement = statement.where(Guest.status == "checked_in", Guest.check_in_date.like(f"{today}%"))

    guests = list(db.scalars(statement).all())
    return [guest for guest in guests if guest.whatsapp_phone or guest.phone]


@router.get("", response_model=list[CampaignRead])
def list_campaigns(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[CampaignRead]:
    ensure_hotel_scope(hotel_id, context)
    campaigns = db.scalars(
        select(Campaign).where(Campaign.tenant_id == hotel_id).order_by(Campaign.created_at.desc())
    ).all()
    return [_campaign_to_read(db, campaign) for campaign in campaigns]


@router.post("", response_model=CampaignRead, status_code=201)
def create_campaign(
    hotel_id: str,
    payload: CampaignCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> CampaignRead:
    ensure_hotel_scope(hotel_id, context)
    guests = _target_guests(db, hotel_id, payload)
    if payload.target_type == "specific" and not guests:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target guest not found or has no WhatsApp phone")

    status_value = "scheduled" if payload.scheduled_at else "queued"
    campaign = Campaign(
        hotel_id=hotel_id,
        name=payload.name,
        template_name=payload.template_name,
        language_code=payload.language_code,
        target_type=payload.target_type,
        target_guest_id=payload.target_guest_id,
        params=payload.params,
        status=status_value,
        scheduled_at=payload.scheduled_at,
        created_by=str(context.user_id),
    )
    db.add(campaign)
    db.flush()

    for guest in guests:
        db.add(
            CampaignDelivery(
                hotel_id=hotel_id,
                campaign_id=campaign.id,
                guest_id=guest.id,
                phone=guest.whatsapp_phone or guest.phone or "",
                status="queued",
            )
        )

    db.commit()
    db.refresh(campaign)
    return _campaign_to_read(db, campaign)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign(
    hotel_id: str,
    campaign_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> CampaignRead:
    ensure_hotel_scope(hotel_id, context)
    campaign = db.scalar(select(Campaign).where(Campaign.tenant_id == hotel_id, Campaign.id == campaign_id))
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return _campaign_to_read(db, campaign)


@router.get("/{campaign_id}/deliveries", response_model=list[CampaignDeliveryRead])
def list_campaign_deliveries(
    hotel_id: str,
    campaign_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[CampaignDeliveryRead]:
    ensure_hotel_scope(hotel_id, context)
    deliveries = db.scalars(
        select(CampaignDelivery)
        .where(CampaignDelivery.tenant_id == hotel_id, CampaignDelivery.campaign_id == campaign_id)
        .order_by(CampaignDelivery.created_at.desc())
    ).all()
    return [_delivery_to_read(delivery) for delivery in deliveries]

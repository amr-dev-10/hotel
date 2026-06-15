from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies import get_platform_admin
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.core.security import create_platform_access_token, verify_password
from app.models.hotel import Hotel
from app.models.ops import Subscription
from app.models.platform_admin import PlatformAdmin, PlatformSetting
from app.models.room import Room
from app.models.ticket import Ticket
from app.models.user import User
from app.models.whatsapp import WhatsAppUsage
from app.schemas.auth import LoginRequest
from app.schemas.hotel import HotelBootstrapRequest, HotelRead
from app.schemas.platform import (
    PlatformDashboardRead,
    PlatformHotelCreate,
    PlatformHotelCreateResponse,
    PlatformHotelSummary,
    PlatformSettingRead,
    PlatformSettingsUpdate,
    PlatformSubscriptionSummary,
    PlatformUserSummary,
)
from app.schemas.user import UserRead
from app.services.hotel_service import HotelService
from app.models.base import utcnow

router = APIRouter()

PLAN_MRR = {
    "starter": Decimal("0"),
    "professional": Decimal("4999"),
    "enterprise": Decimal("14999"),
}

DEFAULT_PLATFORM_SETTINGS = {
    "whatsapp_templates": [],
    "ai_providers": {"default": "local", "enabled": ["local"]},
    "smtp": {},
    "sms": {},
    "branding": {"product_name": "Arcadia"},
    "feature_flags": {
        "restaurant_enabled": True,
        "inventory_enabled": True,
        "maintenance_enabled": True,
    },
}


@router.post("/auth/login")
def platform_login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict:
    admin = db.execute(
        select(PlatformAdmin).where(PlatformAdmin.email == payload.email)
    ).scalar_one_or_none()
    if not admin or not admin.is_active or not verify_password(payload.password, admin.password_hash):
        raise bad_request("Invalid email or password")
    admin.last_login_at = utcnow()
    db.commit()
    token = create_platform_access_token(
        admin.id,
        claims={"email": admin.email, "name": admin.name},
    )
    return ok(
        {
            "access_token": token,
            "token_type": "bearer",
            "expires_in_minutes": settings.access_token_expire_minutes,
        }
    )


@router.get("/dashboard")
def platform_dashboard(
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    total_hotels = db.execute(select(func.count()).select_from(Hotel)).scalar_one()
    active_hotels = db.execute(
        select(func.count()).select_from(Hotel).where(Hotel.status == "active", Hotel.deleted_at.is_(None))
    ).scalar_one()
    total_rooms = db.execute(
        select(func.count()).select_from(Room).where(Room.deleted_at.is_(None))
    ).scalar_one()
    total_users = db.execute(
        select(func.count()).select_from(User).where(User.deleted_at.is_(None))
    ).scalar_one()
    subscriptions = db.execute(select(Subscription)).scalars().all()
    mrr = sum((PLAN_MRR.get(row.plan.lower(), Decimal("0")) for row in subscriptions), Decimal("0"))
    usage = db.execute(
        select(
            func.coalesce(func.sum(WhatsAppUsage.messages_sent), 0),
            func.coalesce(func.sum(WhatsAppUsage.messages_received), 0),
            func.coalesce(func.sum(WhatsAppUsage.estimated_cost), 0),
        )
    ).one()
    data = PlatformDashboardRead(
        total_hotels=total_hotels,
        active_hotels=active_hotels,
        total_rooms=total_rooms,
        total_users=total_users,
        mrr=mrr,
        whatsapp_usage={
            "messages_sent": int(usage[0] or 0),
            "messages_received": int(usage[1] or 0),
            "estimated_cost": float(usage[2] or 0),
        },
    )
    return ok(data.model_dump())


@router.get("/hotels")
def list_platform_hotels(
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    hotels = db.execute(
        select(Hotel).where(Hotel.deleted_at.is_(None)).order_by(Hotel.created_at.desc())
    ).scalars().all()
    data = []
    for hotel in hotels:
        data.append(
            PlatformHotelSummary(
                id=hotel.id,
                slug=hotel.slug,
                name=hotel.name,
                subscription_tier=hotel.subscription_tier,
                status=hotel.status,
                active_users=_count_active_users(db, hotel.id),
                total_rooms=_count_rooms(db, hotel.id),
                open_tickets=_count_open_tickets(db, hotel.id),
                created_at=hotel.created_at,
            ).model_dump()
        )
    return ok(data)


@router.post("/hotels")
def create_platform_hotel(
    payload: PlatformHotelCreate,
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    result = HotelService(db).bootstrap(
        HotelBootstrapRequest(
            slug=payload.slug,
            name=payload.name,
            owner_name=payload.owner_name,
            owner_email=payload.owner_email,
            owner_password=payload.owner_password,
            address=payload.address,
            timezone=payload.timezone,
            contact_phone=payload.contact_phone,
            whatsapp_phone_number_id=payload.whatsapp_phone_number_id,
            seed_rooms=payload.seed_rooms,
        )
    )
    hotel = result["hotel"]
    owner = result["owner"]
    hotel.subscription_tier = payload.subscription_tier
    subscription = db.execute(
        select(Subscription).where(Subscription.hotel_id == hotel.id)
    ).scalar_one_or_none()
    if subscription:
        subscription.plan = payload.subscription_tier
    db.commit()
    db.refresh(hotel)
    db.refresh(owner)
    response = PlatformHotelCreateResponse(
        hotel=HotelRead.model_validate(hotel),
        owner=UserRead.model_validate(owner),
    )
    return ok(response.model_dump())


@router.get("/users")
def list_platform_users(
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    users = db.execute(
        select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())
    ).scalars().all()
    return ok([PlatformUserSummary.model_validate(user).model_dump() for user in users])


@router.get("/subscriptions")
def list_platform_subscriptions(
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    subscriptions = db.execute(select(Subscription).order_by(Subscription.created_at.desc())).scalars().all()
    return ok([PlatformSubscriptionSummary.model_validate(item).model_dump() for item in subscriptions])


@router.get("/platform-settings")
def get_platform_settings(
    db: Session = Depends(get_db),
    _: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    _seed_platform_settings(db)
    settings_rows = db.execute(select(PlatformSetting).order_by(PlatformSetting.key)).scalars().all()
    return ok([PlatformSettingRead.model_validate(item).model_dump() for item in settings_rows])


@router.put("/platform-settings")
def update_platform_settings(
    payload: PlatformSettingsUpdate,
    db: Session = Depends(get_db),
    admin: PlatformAdmin = Depends(get_platform_admin),
) -> dict:
    _seed_platform_settings(db)
    for key, value in payload.settings.items():
        setting = db.execute(select(PlatformSetting).where(PlatformSetting.key == key)).scalar_one_or_none()
        if not setting:
            setting = PlatformSetting(key=key, value=value, updated_by=admin.id)
            db.add(setting)
            continue
        setting.value = value
        setting.updated_by = admin.id
    db.commit()
    settings_rows = db.execute(select(PlatformSetting).order_by(PlatformSetting.key)).scalars().all()
    return ok([PlatformSettingRead.model_validate(item).model_dump() for item in settings_rows])


def _seed_platform_settings(db: Session) -> None:
    for key, value in DEFAULT_PLATFORM_SETTINGS.items():
        existing = db.execute(select(PlatformSetting).where(PlatformSetting.key == key)).scalar_one_or_none()
        if existing:
            continue
        db.add(PlatformSetting(key=key, value=value))
    db.commit()


def _count_active_users(db: Session, hotel_id: str) -> int:
    return db.execute(
        select(func.count()).select_from(User).where(
            User.hotel_id == hotel_id,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    ).scalar_one()


def _count_rooms(db: Session, hotel_id: str) -> int:
    return db.execute(
        select(func.count()).select_from(Room).where(Room.hotel_id == hotel_id, Room.deleted_at.is_(None))
    ).scalar_one()


def _count_open_tickets(db: Session, hotel_id: str) -> int:
    return db.execute(
        select(func.count()).select_from(Ticket).where(
            Ticket.hotel_id == hotel_id,
            Ticket.deleted_at.is_(None),
            Ticket.stage.notin_(["approved", "cancelled", "closed"]),
        )
    ).scalar_one()

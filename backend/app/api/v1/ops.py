from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.ops_repository import (
    AuditLogRepository,
    InvoiceRepository,
    MediaFileRepository,
    NotificationRepository,
)
from app.schemas.ops import (
    AuditLogRead,
    InvoiceCreate,
    InvoiceRead,
    MediaFileCreate,
    MediaFileRead,
    NotificationCreate,
    NotificationRead,
    SubscriptionRead,
)
from app.services.ops_service import BillingService, MediaService, NotificationCenterService

router = APIRouter()


@router.get("/audit-logs")
def list_audit_logs(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    logs = AuditLogRepository(db).list_for_hotel(hotel_id)
    return ok([AuditLogRead.model_validate(item).model_dump() for item in logs])


@router.get("/notifications")
def list_notifications(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("ticket.view")),
) -> dict:
    notifications = NotificationRepository(db).list_for_hotel(hotel_id)
    return ok([NotificationRead.model_validate(item).model_dump() for item in notifications])


@router.post("/notifications")
def create_notification(
    hotel_id: str,
    payload: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    notification = NotificationCenterService(db).create(hotel_id, payload)
    return ok(NotificationRead.model_validate(notification).model_dump())


@router.get("/media")
def list_media(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.manage")),
) -> dict:
    media = MediaFileRepository(db).list_for_hotel(hotel_id)
    return ok([MediaFileRead.model_validate(item).model_dump() for item in media])


@router.post("/media")
def register_media(
    hotel_id: str,
    payload: MediaFileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.manage")),
) -> dict:
    media = MediaService(db).register_file(hotel_id, payload, current_user.id)
    return ok(MediaFileRead.model_validate(media).model_dump())


@router.get("/billing/subscription")
def get_subscription(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view")),
) -> dict:
    subscription = BillingService(db).get_or_create_subscription(hotel_id)
    return ok(SubscriptionRead.model_validate(subscription).model_dump())


@router.get("/billing/invoices")
def list_invoices(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view")),
) -> dict:
    invoices = InvoiceRepository(db).list_for_hotel(hotel_id)
    return ok([InvoiceRead.model_validate(item).model_dump() for item in invoices])


@router.post("/billing/invoices")
def create_invoice(
    hotel_id: str,
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view")),
) -> dict:
    invoice = BillingService(db).create_invoice(hotel_id, payload)
    return ok(InvoiceRead.model_validate(invoice).model_dump())

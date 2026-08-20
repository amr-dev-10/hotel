from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user, require_hotel_admin, require_permission
from app.core.database import get_db
from app.core.exceptions import bad_request
from app.core.responses import ok
from app.models.user import User
from app.repositories.ops_repository import (
    AuditLogRepository,
    InvoiceRepository,
    MediaFileRepository,
    NotificationRepository,
)
from app.repositories.user_repository import FCMTokenRepository
from app.schemas.ops import (
    AuditLogRead,
    FCMTokenRead,
    FCMTokenRegister,
    InvoiceCreate,
    InvoiceRead,
    MediaFileCreate,
    MediaFileRead,
    NotificationCreate,
    NotificationRead,
    SubscriptionRead,
    SubscriptionUpgrade,
)
from app.services.ops_service import BillingService, MediaService, NotificationCenterService

router = APIRouter()


@router.get("/audit-logs")
def list_audit_logs(
    hotel_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    action: str | None = None,
    entity: str | None = None,
    user_id: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_hotel_admin),
) -> dict:
    logs = AuditLogRepository(db).list_for_hotel(
        hotel_id,
        limit=limit,
        action=action,
        entity=entity,
        user_id=user_id,
        search=search,
    )
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


@router.get("/notifications/me")
def my_notifications(
    hotel_id: str,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    notifications = NotificationRepository(db).list_visible_for_user(
        hotel_id,
        current_user.id,
        unread_only=unread_only,
    )
    return ok([NotificationRead.model_validate(item).model_dump() for item in notifications])


@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    hotel_id: str,
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    notification = NotificationCenterService(db).mark_read(
        hotel_id,
        notification_id,
        current_user.id,
    )
    return ok(NotificationRead.model_validate(notification).model_dump())


@router.post("/notifications/{notification_id}/read")
def mark_notification_read_post(
    hotel_id: str,
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    notification = NotificationCenterService(db).mark_read(
        hotel_id,
        notification_id,
        current_user.id,
    )
    return ok(NotificationRead.model_validate(notification).model_dump())


@router.post("/notifications/fcm-token")
def register_fcm_token(
    hotel_id: str,
    payload: FCMTokenRegister,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    token = FCMTokenRepository(db).upsert(
        hotel_id,
        current_user.id,
        payload.token,
        payload.platform.lower(),
    )
    return ok(FCMTokenRead.model_validate(token).model_dump())


@router.delete("/notifications/fcm-token")
def unregister_fcm_token(
    hotel_id: str,
    token: str = Query(min_length=20),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    deleted = FCMTokenRepository(db).delete_for_user(current_user.id, token)
    return ok({"deleted": deleted})


@router.get("/media")
def list_media(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.upload")),
) -> dict:
    media = MediaFileRepository(db).list_for_hotel(hotel_id)
    return ok([MediaFileRead.model_validate(item).model_dump() for item in media])


@router.post("/media")
def register_media(
    hotel_id: str,
    payload: MediaFileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.upload")),
) -> dict:
    media = MediaService(db).register_file(hotel_id, payload, current_user.id)
    return ok(MediaFileRead.model_validate(media).model_dump())


@router.post("/media/upload")
def upload_media_alias(
    hotel_id: str,
    payload: MediaFileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.upload")),
) -> dict:
    media = MediaService(db).register_file(hotel_id, payload, current_user.id)
    return ok(MediaFileRead.model_validate(media).model_dump())


@router.delete("/media/{media_id}")
def delete_media(
    hotel_id: str,
    media_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.delete")),
) -> dict:
    media = MediaFileRepository(db).get_for_hotel(hotel_id, media_id)
    if media:
        if MediaService(db).is_url_referenced(hotel_id, media.file_url):
            duplicates = [
                duplicate
                for duplicate in MediaFileRepository(db).list_for_hotel(hotel_id, limit=500)
                if duplicate.file_url == media.file_url and duplicate.id != media.id
            ]
            if not duplicates:
                raise bad_request("Media file is still used. Remove it from the related record first.")
        db.delete(media)
        db.commit()
    return ok({"deleted": True, "media_id": media_id})


@router.post("/media/cleanup-orphans")
def cleanup_orphaned_media(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("media.delete")),
) -> dict:
    deleted = MediaService(db).cleanup_orphaned_files(hotel_id)
    db.commit()
    return ok({"deleted": deleted})


@router.get("/billing/subscription")
def get_subscription(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view")),
) -> dict:
    subscription = BillingService(db).get_or_create_subscription(hotel_id)
    return ok(SubscriptionRead.model_validate(subscription).model_dump())


@router.get("/subscription")
def get_subscription_alias(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.billing.view")),
) -> dict:
    subscription = BillingService(db).get_or_create_subscription(hotel_id)
    return ok(SubscriptionRead.model_validate(subscription).model_dump())


@router.post("/subscription/upgrade")
def upgrade_subscription(
    hotel_id: str,
    payload: SubscriptionUpgrade,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    subscription = BillingService(db).upgrade_subscription(hotel_id, payload)
    return ok(SubscriptionRead.model_validate(subscription).model_dump())


@router.get("/billing/invoices")
def list_invoices(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view")),
) -> dict:
    invoices = InvoiceRepository(db).list_for_hotel(hotel_id)
    return ok([InvoiceRead.model_validate(item).model_dump() for item in invoices])


@router.get("/invoices")
def list_invoices_alias(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.billing.view")),
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

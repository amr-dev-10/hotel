import base64
import binascii
from pathlib import Path
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.models.base import utcnow
from app.models.ops import Invoice, MediaFile, Notification, Subscription
from app.repositories.ops_repository import InvoiceRepository, MediaFileRepository, NotificationRepository, SubscriptionRepository
from app.schemas.ops import InvoiceCreate, MediaFileCreate, NotificationCreate
from app.schemas.ops import SubscriptionUpgrade
from app.services.notification_service import NotificationService


class NotificationCenterService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.notifications = NotificationRepository(db)

    def create(self, hotel_id: str, payload: NotificationCreate, commit: bool = True) -> Notification:
        notification = Notification(
            hotel_id=hotel_id,
            user_id=payload.user_id,
            channel=payload.channel,
            title=payload.title,
            message=payload.message,
            status="pending",
            notification_type=payload.notification_type,
            reference_id=payload.reference_id,
            metadata_json=payload.metadata,
            created_at=utcnow(),
        )
        self.db.add(notification)
        self.db.flush()
        notification_service = NotificationService(self.db)
        notification_service.publish_user_notification(
            hotel_id,
            notification.user_id,
            {
                "event": "notification",
                "notification": {
                    "id": notification.id,
                    "hotel_id": notification.hotel_id,
                    "user_id": notification.user_id,
                    "channel": notification.channel,
                    "title": notification.title,
                    "message": notification.message,
                    "status": notification.status,
                    "notification_type": notification.notification_type,
                    "reference_id": notification.reference_id,
                    "metadata": notification.metadata_json,
                    "read_at": notification.read_at,
                    "created_at": notification.created_at,
                },
            },
        )
        if notification.channel == "fcm":
            notification_service.send_fcm_to_user(
                notification.user_id,
                notification.title,
                notification.message,
                {
                    "notification_id": notification.id,
                    "notification_type": notification.notification_type,
                    "reference_id": notification.reference_id,
                    **(notification.metadata_json or {}),
                },
            )
        if commit:
            self.db.commit()
            self.db.refresh(notification)
        return notification

    def mark_read(self, hotel_id: str, notification_id: str, user_id: str) -> Notification:
        notification = self.notifications.get_for_hotel(hotel_id, notification_id)
        if not notification or notification.user_id not in {None, user_id}:
            from app.core.exceptions import not_found

            raise not_found("Notification not found")
        notification.status = "read"
        notification.read_at = utcnow()
        self.db.commit()
        self.db.refresh(notification)
        return notification


class MediaService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.media = MediaFileRepository(db)

    def register_file(
        self,
        hotel_id: str,
        payload: MediaFileCreate,
        uploaded_by: str | None,
    ) -> MediaFile:
        decoded_size = payload.file_size_bytes
        if payload.file_data_base64:
            try:
                decoded_size = len(base64.b64decode(payload.file_data_base64.encode("ascii"), validate=True))
            except (UnicodeEncodeError, binascii.Error, ValueError) as exc:
                raise bad_request("file_data_base64 must be valid base64") from exc
        file_url = payload.file_url
        if not file_url and payload.file_data_base64:
            suffix = Path(payload.file_name or "").suffix or _suffix_for_media_type(payload.file_type)
            file_url = f"/media/mobile/{hotel_id}/{uuid4().hex}{suffix}"
        if not file_url:
            raise bad_request("file_url is required when media data is not provided")
        media = MediaFile(
            hotel_id=hotel_id,
            file_url=file_url,
            file_type=payload.file_type,
            file_name=payload.file_name,
            file_size_bytes=decoded_size,
            storage_provider="database" if payload.file_data_base64 else payload.storage_provider,
            file_data_base64=payload.file_data_base64,
            uploaded_by=uploaded_by,
            created_at=utcnow(),
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media


def _suffix_for_media_type(media_type: str) -> str:
    if media_type == "image/png":
        return ".png"
    if media_type == "image/webp":
        return ".webp"
    if media_type == "image/gif":
        return ".gif"
    return ".jpg"


class BillingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.subscriptions = SubscriptionRepository(db)
        self.invoices = InvoiceRepository(db)

    def get_or_create_subscription(self, hotel_id: str) -> Subscription:
        subscription = self.subscriptions.get_by_hotel(hotel_id)
        if not subscription:
            subscription = Subscription(hotel_id=hotel_id, plan="starter", status="active")
            self.db.add(subscription)
            self.db.commit()
            self.db.refresh(subscription)
        return subscription

    def upgrade_subscription(self, hotel_id: str, payload: SubscriptionUpgrade) -> Subscription:
        subscription = self.get_or_create_subscription(hotel_id)
        subscription.plan = payload.plan
        subscription.billing_cycle = payload.billing_cycle
        subscription.status = "active"
        self.db.commit()
        self.db.refresh(subscription)
        return subscription

    def create_invoice(self, hotel_id: str, payload: InvoiceCreate) -> Invoice:
        subscription = self.get_or_create_subscription(hotel_id)
        invoice = Invoice(
            hotel_id=hotel_id,
            subscription_id=subscription.id,
            amount=payload.amount,
            currency=payload.currency,
            stripe_invoice_id=payload.stripe_invoice_id,
            status=payload.status,
            payment_method=payload.payment_method,
            due_date=payload.due_date,
            created_at=utcnow(),
        )
        self.db.add(invoice)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

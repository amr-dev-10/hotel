import base64
import binascii
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.models.base import utcnow
from app.models.knowledge import KnowledgeDocument, KnowledgeDocumentVersion
from app.models.menu import MenuItem
from app.models.ops import Invoice, MediaFile, Notification, Subscription
from app.models.ops import ExportJob, ImportJob, LostFoundItem
from app.models.ticket import Ticket
from app.models.user import User
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
        existing = self._find_existing_file(hotel_id, payload, decoded_size, file_url)
        if existing:
            return existing
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

    def cleanup_unreferenced_urls(self, hotel_id: str, urls: set[str] | list[str] | tuple[str, ...]) -> int:
        deleted = 0
        self.db.flush()
        for url in {clean for value in urls if (clean := _clean_media_url(value))}:
            rows = self.db.execute(
                select(MediaFile)
                .where(MediaFile.hotel_id == hotel_id, MediaFile.file_url == url)
                .order_by(MediaFile.created_at, MediaFile.id)
            ).scalars().all()
            if len(rows) > 1 and self.is_url_referenced(hotel_id, url):
                for duplicate in rows[1:]:
                    self.db.delete(duplicate)
                    deleted += 1
                continue
            if rows and not self.is_url_referenced(hotel_id, url):
                for media in rows:
                    self.db.delete(media)
                    deleted += 1
        if deleted:
            self.db.flush()
        return deleted

    def cleanup_removed_urls(self, hotel_id: str, before: Any, after: Any) -> int:
        return self.cleanup_unreferenced_urls(
            hotel_id,
            _extract_media_urls(before) - _extract_media_urls(after),
        )

    def cleanup_orphaned_files(self, hotel_id: str) -> int:
        deleted = 0
        self.db.flush()
        rows = self.db.execute(
            select(MediaFile).where(MediaFile.hotel_id == hotel_id).order_by(MediaFile.file_url, MediaFile.created_at, MediaFile.id)
        ).scalars().all()
        seen_urls: set[str] = set()
        for media in rows:
            if media.file_url in seen_urls:
                self.db.delete(media)
                deleted += 1
                continue
            seen_urls.add(media.file_url)
            if not self.is_url_referenced(hotel_id, media.file_url):
                self.db.delete(media)
                deleted += 1
        if deleted:
            self.db.flush()
        return deleted

    def is_url_referenced(self, hotel_id: str, url: str) -> bool:
        if not _clean_media_url(url):
            return False
        checks = [
            select(User.id).where(
                User.hotel_id == hotel_id,
                User.deleted_at.is_(None),
                User.profile_image_url == url,
            ),
            select(MenuItem.id).where(
                MenuItem.hotel_id == hotel_id,
                MenuItem.deleted_at.is_(None),
                MenuItem.image_url == url,
            ),
            select(LostFoundItem.id).where(
                LostFoundItem.hotel_id == hotel_id,
                LostFoundItem.photo_url == url,
            ),
            select(KnowledgeDocument.id).where(
                KnowledgeDocument.hotel_id == hotel_id,
                KnowledgeDocument.is_active.is_(True),
                KnowledgeDocument.file_url == url,
            ),
            select(KnowledgeDocumentVersion.id).where(
                KnowledgeDocumentVersion.hotel_id == hotel_id,
                KnowledgeDocumentVersion.file_url == url,
            ),
            select(ExportJob.id).where(
                ExportJob.hotel_id == hotel_id,
                ExportJob.file_url == url,
            ),
            select(ImportJob.id).where(
                ImportJob.hotel_id == hotel_id,
                ImportJob.source_file_url == url,
            ),
        ]
        for statement in checks:
            if self.db.execute(statement.limit(1)).first():
                return True

        active_tickets = self.db.execute(
            select(Ticket.mobile_payload).where(
                Ticket.hotel_id == hotel_id,
                Ticket.deleted_at.is_(None),
            )
        ).scalars().all()
        return any(url in _extract_media_urls(payload) for payload in active_tickets)

    def _find_existing_file(
        self,
        hotel_id: str,
        payload: MediaFileCreate,
        decoded_size: int | None,
        file_url: str | None,
    ) -> MediaFile | None:
        if file_url:
            existing = self.db.execute(
                select(MediaFile)
                .where(MediaFile.hotel_id == hotel_id, MediaFile.file_url == file_url)
                .order_by(MediaFile.created_at, MediaFile.id)
            ).scalars().first()
            if existing:
                return existing
        if not payload.file_data_base64:
            return None
        return self.db.execute(
            select(MediaFile)
            .where(
                MediaFile.hotel_id == hotel_id,
                MediaFile.file_type == payload.file_type,
                MediaFile.file_size_bytes == decoded_size,
                MediaFile.file_data_base64 == payload.file_data_base64,
            )
            .order_by(MediaFile.created_at, MediaFile.id)
        ).scalars().first()


def _clean_media_url(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    url = value.strip()
    return url or None


def _extract_media_urls(value: Any) -> set[str]:
    urls: set[str] = set()
    if isinstance(value, str):
        url = value.strip()
        if url.startswith("/media/") or url.startswith("http://") or url.startswith("https://"):
            urls.add(url)
    elif isinstance(value, dict):
        for nested in value.values():
            urls.update(_extract_media_urls(nested))
    elif isinstance(value, list | tuple | set):
        for nested in value:
            urls.update(_extract_media_urls(nested))
    return urls


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

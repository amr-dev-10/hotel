from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.ops import Invoice, MediaFile, Notification, Subscription
from app.repositories.ops_repository import InvoiceRepository, MediaFileRepository, NotificationRepository, SubscriptionRepository
from app.schemas.ops import InvoiceCreate, MediaFileCreate, NotificationCreate


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
            created_at=utcnow(),
        )
        self.db.add(notification)
        if commit:
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
        media = MediaFile(
            hotel_id=hotel_id,
            file_url=payload.file_url,
            file_type=payload.file_type,
            uploaded_by=uploaded_by,
            created_at=utcnow(),
        )
        self.db.add(media)
        self.db.commit()
        self.db.refresh(media)
        return media


class BillingService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.subscriptions = SubscriptionRepository(db)
        self.invoices = InvoiceRepository(db)

    def get_or_create_subscription(self, hotel_id: str) -> Subscription:
        subscription = self.subscriptions.get(hotel_id)
        if not subscription:
            subscription = Subscription(hotel_id=hotel_id, plan="starter", status="active")
            self.db.add(subscription)
            self.db.commit()
            self.db.refresh(subscription)
        return subscription

    def create_invoice(self, hotel_id: str, payload: InvoiceCreate) -> Invoice:
        subscription = self.get_or_create_subscription(hotel_id)
        invoice = Invoice(
            hotel_id=hotel_id,
            subscription_id=subscription.hotel_id,
            amount=payload.amount,
            currency=payload.currency,
            stripe_invoice_id=payload.stripe_invoice_id,
            status=payload.status,
            created_at=utcnow(),
        )
        self.db.add(invoice)
        self.db.commit()
        self.db.refresh(invoice)
        return invoice

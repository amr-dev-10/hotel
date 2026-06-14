from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ops import AuditLog, Invoice, MediaFile, Notification, Subscription
from app.repositories.base import BaseRepository


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, AuditLog)


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Notification)

    def list_for_user(self, hotel_id: str, user_id: str) -> Sequence[Notification]:
        return self.db.execute(
            select(Notification).where(
                Notification.hotel_id == hotel_id,
                Notification.user_id == user_id,
            )
        ).scalars().all()


class MediaFileRepository(BaseRepository[MediaFile]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, MediaFile)


class SubscriptionRepository(BaseRepository[Subscription]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Subscription)


class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Invoice)

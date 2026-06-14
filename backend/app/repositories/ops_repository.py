from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ops import (
    AnalyticsSnapshot,
    AuditLog,
    HotelSecret,
    HousekeepingChecklist,
    HousekeepingSchedule,
    Invoice,
    LostFoundItem,
    MaintenanceOrder,
    MediaFile,
    Notification,
    Subscription,
)
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


class HotelSecretRepository(BaseRepository[HotelSecret]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, HotelSecret)

    def get_by_type(self, hotel_id: str, secret_type: str) -> HotelSecret | None:
        return self.db.execute(
            select(HotelSecret).where(
                HotelSecret.hotel_id == hotel_id,
                HotelSecret.secret_type == secret_type,
            )
        ).scalar_one_or_none()


class AnalyticsSnapshotRepository(BaseRepository[AnalyticsSnapshot]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, AnalyticsSnapshot)

    def get_by_date(self, hotel_id: str, snapshot_date) -> AnalyticsSnapshot | None:
        return self.db.execute(
            select(AnalyticsSnapshot).where(
                AnalyticsSnapshot.hotel_id == hotel_id,
                AnalyticsSnapshot.snapshot_date == snapshot_date,
            )
        ).scalar_one_or_none()

    def list_range(self, hotel_id: str, start_date, end_date) -> Sequence[AnalyticsSnapshot]:
        return self.db.execute(
            select(AnalyticsSnapshot)
            .where(
                AnalyticsSnapshot.hotel_id == hotel_id,
                AnalyticsSnapshot.snapshot_date >= start_date,
                AnalyticsSnapshot.snapshot_date <= end_date,
            )
            .order_by(AnalyticsSnapshot.snapshot_date)
        ).scalars().all()


class HousekeepingScheduleRepository(BaseRepository[HousekeepingSchedule]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, HousekeepingSchedule)


class HousekeepingChecklistRepository(BaseRepository[HousekeepingChecklist]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, HousekeepingChecklist)

    def get_for_task_type(self, hotel_id: str, task_type: str) -> HousekeepingChecklist | None:
        return self.db.execute(
            select(HousekeepingChecklist).where(
                HousekeepingChecklist.hotel_id == hotel_id,
                HousekeepingChecklist.task_type == task_type,
            )
        ).scalar_one_or_none()


class MaintenanceOrderRepository(BaseRepository[MaintenanceOrder]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, MaintenanceOrder)


class LostFoundRepository(BaseRepository[LostFoundItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, LostFoundItem)


class SubscriptionRepository(BaseRepository[Subscription]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Subscription)

    def get_by_hotel(self, hotel_id: str) -> Subscription | None:
        return self.db.execute(
            select(Subscription).where(Subscription.hotel_id == hotel_id)
        ).scalar_one_or_none()


class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Invoice)

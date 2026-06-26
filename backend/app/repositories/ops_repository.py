from collections.abc import Sequence

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.ops import (
    AnalyticsSnapshot,
    ApiRateLimit,
    AuditLog,
    ExportJob,
    HotelSecret,
    HousekeepingChecklist,
    HousekeepingSchedule,
    ImportJob,
    Invoice,
    JobExecution,
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

    def list_for_hotel(
        self,
        hotel_id: str,
        limit: int = 100,
        cursor: str | None = None,
        action: str | None = None,
        entity: str | None = None,
        user_id: str | None = None,
        search: str | None = None,
    ) -> Sequence[AuditLog]:
        statement = select(AuditLog).where(AuditLog.hotel_id == hotel_id)
        if cursor:
            statement = statement.where(AuditLog.id > cursor)
        if action:
            statement = statement.where(AuditLog.action == action)
        if entity:
            statement = statement.where(AuditLog.entity == entity)
        if user_id:
            statement = statement.where(AuditLog.user_id == user_id)
        if search:
            pattern = f"%{search.strip()}%"
            statement = statement.where(
                or_(
                    AuditLog.action.ilike(pattern),
                    AuditLog.entity.ilike(pattern),
                    AuditLog.entity_id.ilike(pattern),
                    AuditLog.user_id.ilike(pattern),
                    AuditLog.ip_address.ilike(pattern),
                )
            )
        return self.db.execute(statement.order_by(AuditLog.created_at.desc()).limit(limit)).scalars().all()


class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Notification)

    def list_for_user(
        self,
        hotel_id: str,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
    ) -> Sequence[Notification]:
        statement = select(Notification).where(
            Notification.hotel_id == hotel_id,
            Notification.user_id == user_id,
        )
        if unread_only:
            statement = statement.where(Notification.read_at.is_(None))
        return self.db.execute(statement.order_by(Notification.created_at.desc()).limit(limit)).scalars().all()

    def list_visible_for_user(
        self,
        hotel_id: str,
        user_id: str,
        unread_only: bool = False,
        limit: int = 50,
    ) -> Sequence[Notification]:
        statement = select(Notification).where(
            Notification.hotel_id == hotel_id,
            or_(Notification.user_id == user_id, Notification.user_id.is_(None)),
        )
        if unread_only:
            statement = statement.where(Notification.read_at.is_(None))
        return self.db.execute(statement.order_by(Notification.created_at.desc()).limit(limit)).scalars().all()


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


class JobExecutionRepository(BaseRepository[JobExecution]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, JobExecution)

    def list_filtered(
        self,
        hotel_id: str | None = None,
        status: str | None = None,
        limit: int = 100,
    ) -> Sequence[JobExecution]:
        statement = select(JobExecution)
        if hotel_id:
            statement = statement.where(JobExecution.hotel_id == hotel_id)
        if status:
            statement = statement.where(JobExecution.status == status)
        return self.db.execute(statement.order_by(JobExecution.created_at.desc()).limit(limit)).scalars().all()


class ApiRateLimitRepository(BaseRepository[ApiRateLimit]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ApiRateLimit)

    def get_for_group(self, hotel_id: str, endpoint_group: str) -> ApiRateLimit | None:
        return self.db.execute(
            select(ApiRateLimit).where(
                ApiRateLimit.hotel_id == hotel_id,
                ApiRateLimit.endpoint_group == endpoint_group,
            )
        ).scalar_one_or_none()


class ExportJobRepository(BaseRepository[ExportJob]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ExportJob)


class ImportJobRepository(BaseRepository[ImportJob]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ImportJob)


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

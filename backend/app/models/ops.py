from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class Subscription(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (UniqueConstraint("hotel_id", name="uq_subscriptions_hotel"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    plan: Mapped[str] = mapped_column(String(40), default="starter")
    status: Mapped[str] = mapped_column(String(40), default="active")
    renewal_date: Mapped[date | None] = mapped_column(Date)
    billing_cycle: Mapped[str] = mapped_column(String(40), default="monthly")
    current_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Invoice(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "invoices"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    subscription_id: Mapped[str] = mapped_column(ForeignKey("subscriptions.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    stripe_invoice_id: Mapped[str | None] = mapped_column(String(180))
    status: Mapped[str] = mapped_column(String(40), default="draft")
    payment_method: Mapped[str | None] = mapped_column(String(80))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuditLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_logs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(120), index=True)
    entity: Mapped[str] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    old_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    new_payload: Mapped[dict] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Notification(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "notifications"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    channel: Mapped[str] = mapped_column(String(40), index=True)
    title: Mapped[str] = mapped_column(String(180))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(40), default="pending")
    notification_type: Mapped[str] = mapped_column(String(40), default="general", index=True)
    reference_id: Mapped[str | None] = mapped_column(String(36), index=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class MediaFile(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "media_files"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    file_url: Mapped[str] = mapped_column(String(800))
    file_type: Mapped[str] = mapped_column(String(80))
    file_name: Mapped[str | None] = mapped_column(String(255))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    storage_provider: Mapped[str] = mapped_column(String(80), default="local")
    file_data_base64: Mapped[str | None] = mapped_column(Text)
    uploaded_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class HotelSecret(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "hotel_secrets"
    __table_args__ = (UniqueConstraint("hotel_id", "secret_type", name="uq_hotel_secret_type"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    secret_type: Mapped[str] = mapped_column(String(120), index=True)
    encrypted_value: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class AnalyticsSnapshot(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "analytics_snapshots"
    __table_args__ = (UniqueConstraint("hotel_id", "snapshot_date", name="uq_analytics_hotel_date"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    snapshot_date: Mapped[date] = mapped_column(Date, index=True)
    occupancy_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    total_rooms: Mapped[int] = mapped_column(Integer, default=0)
    occupied_rooms: Mapped[int] = mapped_column(Integer, default=0)
    total_reservations: Mapped[int] = mapped_column(Integer, default=0)
    new_checkins: Mapped[int] = mapped_column(Integer, default=0)
    checkouts: Mapped[int] = mapped_column(Integer, default=0)
    ticket_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_resolution_minutes: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=0)
    guest_satisfaction_avg: Mapped[Decimal] = mapped_column(Numeric(3, 2), default=0)
    revenue_room: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    revenue_food: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    revenue_other: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    revenue_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0)
    whatsapp_messages: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class JobExecution(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "job_executions"

    job_name: Mapped[str] = mapped_column(String(160), index=True)
    job_type: Mapped[str] = mapped_column(String(40), default="manual", index=True)
    hotel_id: Mapped[str | None] = mapped_column(ForeignKey("hotels.id"), index=True)
    status: Mapped[str] = mapped_column(String(40), default="queued", index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    input_params: Mapped[dict] = mapped_column(JSON, default=dict)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    error_traceback: Mapped[str | None] = mapped_column(Text)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, default=3)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    celery_task_id: Mapped[str | None] = mapped_column(String(180), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ApiRateLimit(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "api_rate_limits"
    __table_args__ = (UniqueConstraint("hotel_id", "endpoint_group", name="uq_api_rate_limit_group"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    endpoint_group: Mapped[str] = mapped_column(String(80), index=True)
    max_requests: Mapped[int] = mapped_column(Integer)
    window_seconds: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ExportJob(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "export_jobs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    export_type: Mapped[str] = mapped_column(String(80), index=True)
    format: Mapped[str] = mapped_column(String(20), default="csv")
    filters: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(40), default="queued", index=True)
    file_url: Mapped[str | None] = mapped_column(String(800))
    file_size_bytes: Mapped[int | None] = mapped_column(Integer)
    row_count: Mapped[int | None] = mapped_column(Integer)
    requested_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImportJob(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "import_jobs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    import_type: Mapped[str] = mapped_column(String(80), index=True)
    source_file_url: Mapped[str] = mapped_column(String(800))
    status: Mapped[str] = mapped_column(String(40), default="uploaded", index=True)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    processed_rows: Mapped[int] = mapped_column(Integer, default=0)
    successful_rows: Mapped[int] = mapped_column(Integer, default=0)
    failed_rows: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list[dict]] = mapped_column(JSON, default=list)
    raw_rows: Mapped[list[dict]] = mapped_column(JSON, default=list)
    uploaded_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class HousekeepingSchedule(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "housekeeping_schedules"
    __table_args__ = (
        Index("ix_hk_hotel_status", "hotel_id", "status"),
        Index("ix_hk_hotel_room", "hotel_id", "room_id"),
        Index("ix_hk_hotel_scheduled", "hotel_id", "scheduled_date"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"), index=True)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    task_type: Mapped[str] = mapped_column(String(60), default="daily_clean", index=True)
    scheduled_date: Mapped[date] = mapped_column(Date, index=True)
    scheduled_time: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(40), default="pending", index=True)
    priority: Mapped[int] = mapped_column(Integer, default=2)
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class HousekeepingChecklist(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "housekeeping_checklists"
    __table_args__ = (UniqueConstraint("hotel_id", "task_type", name="uq_housekeeping_checklist_task"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    task_type: Mapped[str] = mapped_column(String(60), index=True)
    items: Mapped[list[dict | str]] = mapped_column(JSON, default=list)


class MaintenanceOrder(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "maintenance_orders"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    room_id: Mapped[str | None] = mapped_column(ForeignKey("rooms.id"), index=True)
    ticket_id: Mapped[str | None] = mapped_column(ForeignKey("tickets.id"), index=True)
    reported_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    category: Mapped[str] = mapped_column(String(80), default="other")
    description: Mapped[str] = mapped_column(Text)
    priority: Mapped[str] = mapped_column(String(40), default="medium")
    status: Mapped[str] = mapped_column(String(40), default="reported", index=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    parts_used: Mapped[list[dict]] = mapped_column(JSON, default=list)
    total_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class LostFoundItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "lost_found_items"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    type: Mapped[str] = mapped_column(String(40), default="found", index=True)
    item_description: Mapped[str] = mapped_column(String(255))
    found_location: Mapped[str | None] = mapped_column(String(180))
    found_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    guest_id: Mapped[str | None] = mapped_column(ForeignKey("guests.id"))
    photo_url: Mapped[str | None] = mapped_column(String(800))
    status: Mapped[str] = mapped_column(String(40), default="unclaimed", index=True)
    found_date: Mapped[date | None] = mapped_column(Date)
    claimed_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

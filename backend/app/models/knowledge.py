from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin


class HotelFAQ(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "hotel_faqs"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    question: Mapped[str] = mapped_column(String(255))
    answer: Mapped[str] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(80), index=True)
    language: Mapped[str] = mapped_column(String(20), default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class BotVersion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "bot_versions"
    __table_args__ = (UniqueConstraint("hotel_id", "version", name="uq_bot_versions_hotel_version"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict)
    published_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class HotelLanguage(Base):
    __tablename__ = "hotel_languages"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), primary_key=True)
    default_language: Mapped[str] = mapped_column(String(20), default="en")
    supported_languages: Mapped[list[str]] = mapped_column(JSON, default=lambda: ["en"])


class DepartmentConfig(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "department_configs"
    __table_args__ = (
        UniqueConstraint("hotel_id", "department_id", name="uq_department_configs_department"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    department_id: Mapped[str] = mapped_column(ForeignKey("departments.id"), index=True)
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    sla_minutes: Mapped[int] = mapped_column(Integer, default=20)
    auto_assignment_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    assignment_strategy: Mapped[str] = mapped_column(String(50), default="round_robin")


class ServiceForm(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "service_forms"
    __table_args__ = (UniqueConstraint("hotel_id", "service_name", name="uq_service_forms_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    service_name: Mapped[str] = mapped_column(String(160))
    service_id: Mapped[str | None] = mapped_column(String(120), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ServiceFormField(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "service_form_fields"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    service_form_id: Mapped[str] = mapped_column(ForeignKey("service_forms.id"), index=True)
    field_name: Mapped[str] = mapped_column(String(160))
    field_type: Mapped[str] = mapped_column(String(40), default="text")
    label: Mapped[str | None] = mapped_column(String(180))
    required: Mapped[bool] = mapped_column(Boolean, default=False)
    options: Mapped[list[dict]] = mapped_column(JSON, default=list)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

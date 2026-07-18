from datetime import date, datetime, time

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, JSON, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import UUIDPrimaryKeyMixin, utcnow


class EmployeeShift(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "employee_shifts"

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    department_id: Mapped[str | None] = mapped_column(ForeignKey("departments.id"), index=True)
    shift_date: Mapped[date] = mapped_column(Date, index=True)
    shift_start: Mapped[time] = mapped_column(Time)
    shift_end: Mapped[time] = mapped_column(Time)
    shift_type: Mapped[str] = mapped_column(String(40), default="custom")
    status: Mapped[str] = mapped_column(String(40), default="scheduled", index=True)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ShiftTemplate(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "shift_templates"
    __table_args__ = (UniqueConstraint("hotel_id", "code", name="uq_shift_templates_hotel_code"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(40))
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    break_minutes: Mapped[int] = mapped_column(Integer, default=0)
    grace_minutes: Mapped[int] = mapped_column(Integer, default=0)
    late_after_minutes: Mapped[int] = mapped_column(Integer, default=0)
    is_night_shift: Mapped[bool] = mapped_column(Boolean, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class EmployeeShiftAssignment(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "employee_shift_assignments"
    __table_args__ = (
        Index("ix_shift_assignments_hotel_employee_dates", "hotel_id", "employee_id", "effective_from", "effective_to"),
        Index("ix_shift_assignments_hotel_active", "hotel_id", "is_active"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    employee_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    shift_template_id: Mapped[str] = mapped_column(ForeignKey("shift_templates.id"), index=True)
    effective_from: Mapped[date] = mapped_column(Date, index=True)
    effective_to: Mapped[date | None] = mapped_column(Date, index=True)
    working_days: Mapped[list[int]] = mapped_column(JSON, default=list)
    rotation_type: Mapped[str] = mapped_column(String(40), default="fixed")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class AttendanceLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "attendance_logs"
    __table_args__ = (
        UniqueConstraint("hotel_id", "employee_id", "attendance_date", name="uq_attendance_logs_employee_date"),
        Index("ix_attendance_logs_hotel_date", "hotel_id", "attendance_date"),
        Index("ix_attendance_logs_hotel_employee_date", "hotel_id", "employee_id", "attendance_date"),
    )

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    employee_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    attendance_date: Mapped[date] = mapped_column(Date, index=True)
    shift_assignment_id: Mapped[str | None] = mapped_column(ForeignKey("employee_shift_assignments.id"))
    shift_template_id: Mapped[str | None] = mapped_column(ForeignKey("shift_templates.id"))
    shift_name: Mapped[str | None] = mapped_column(String(120))
    scheduled_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    scheduled_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attendance_status: Mapped[str] = mapped_column(String(40), default="SCHEDULED", index=True)
    arrival_status: Mapped[str] = mapped_column(String(40), default="UNKNOWN")
    leave_status: Mapped[str] = mapped_column(String(40), default="NONE")
    worked_minutes: Mapped[int] = mapped_column(Integer, default=0)
    late_minutes: Mapped[int] = mapped_column(Integer, default=0)
    early_leave_minutes: Mapped[int] = mapped_column(Integer, default=0)
    overtime_minutes: Mapped[int] = mapped_column(Integer, default=0)
    checkin_method: Mapped[str | None] = mapped_column(String(40))
    checkout_method: Mapped[str | None] = mapped_column(String(40))
    device_info: Mapped[str | None] = mapped_column(String(255))
    ip_address: Mapped[str | None] = mapped_column(String(80))
    gps_location: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    approved_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class HotelHoliday(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "hotel_holidays"
    __table_args__ = (UniqueConstraint("hotel_id", "date", name="uq_hotel_holidays_hotel_date"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    date: Mapped[date] = mapped_column(Date, index=True)
    title: Mapped[str] = mapped_column(String(180))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

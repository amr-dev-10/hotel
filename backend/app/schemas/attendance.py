from datetime import date, datetime, time

from pydantic import Field, field_validator

from app.schemas.common import ORMModel


class ShiftTemplateCreate(ORMModel):
    name: str = Field(min_length=1, max_length=120)
    code: str = Field(min_length=1, max_length=40)
    start_time: time
    end_time: time
    break_minutes: int = Field(default=0, ge=0, le=240)
    grace_minutes: int = Field(default=0, ge=0, le=180)
    late_after_minutes: int = Field(default=0, ge=0, le=180)
    is_night_shift: bool = False
    is_active: bool = True

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        return value.strip().upper()


class ShiftTemplateUpdate(ORMModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    code: str | None = Field(default=None, min_length=1, max_length=40)
    start_time: time | None = None
    end_time: time | None = None
    break_minutes: int | None = Field(default=None, ge=0, le=240)
    grace_minutes: int | None = Field(default=None, ge=0, le=180)
    late_after_minutes: int | None = Field(default=None, ge=0, le=180)
    is_night_shift: bool | None = None
    is_active: bool | None = None

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        return value.strip().upper() if value else value


class ShiftTemplateRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    code: str
    start_time: time
    end_time: time
    break_minutes: int
    grace_minutes: int
    late_after_minutes: int
    is_night_shift: bool
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ShiftAssignmentCreate(ORMModel):
    employee_id: str
    shift_template_id: str
    effective_from: date
    effective_to: date | None = None
    working_days: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5])
    rotation_type: str = Field(default="fixed", max_length=40)
    is_active: bool = True

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, values: list[int]) -> list[int]:
        unique_days = sorted(set(values))
        if not unique_days:
            raise ValueError("At least one working day is required")
        if any(day < 0 or day > 6 for day in unique_days):
            raise ValueError("Working days must be between 0 and 6")
        return unique_days


class ShiftAssignmentUpdate(ORMModel):
    shift_template_id: str | None = None
    effective_from: date | None = None
    effective_to: date | None = None
    working_days: list[int] | None = None
    rotation_type: str | None = Field(default=None, max_length=40)
    is_active: bool | None = None

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, values: list[int] | None) -> list[int] | None:
        if values is None:
            return values
        unique_days = sorted(set(values))
        if not unique_days:
            raise ValueError("At least one working day is required")
        if any(day < 0 or day > 6 for day in unique_days):
            raise ValueError("Working days must be between 0 and 6")
        return unique_days


class ShiftAssignmentRead(ORMModel):
    id: str
    hotel_id: str
    employee_id: str
    shift_template_id: str
    effective_from: date
    effective_to: date | None
    working_days: list[int]
    rotation_type: str
    is_active: bool
    created_by: str | None
    created_at: datetime
    updated_at: datetime
    employee_name: str | None = None
    employee_code: str | None = None
    template_name: str | None = None
    template_code: str | None = None


class AttendanceActionPayload(ORMModel):
    method: str = Field(default="web", max_length=40)
    device_info: str | None = Field(default=None, max_length=255)
    gps_location: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class AttendanceLogRead(ORMModel):
    id: str
    hotel_id: str
    employee_id: str
    attendance_date: date
    shift_assignment_id: str | None
    shift_template_id: str | None
    shift_name: str | None
    scheduled_start: datetime | None
    scheduled_end: datetime | None
    actual_start: datetime | None
    actual_end: datetime | None
    attendance_status: str
    arrival_status: str
    leave_status: str
    worked_minutes: int
    late_minutes: int
    early_leave_minutes: int
    overtime_minutes: int
    checkin_method: str | None
    checkout_method: str | None
    device_info: str | None
    ip_address: str | None
    gps_location: str | None
    notes: str | None
    approved_by: str | None
    created_at: datetime
    updated_at: datetime
    employee_name: str | None = None
    employee_code: str | None = None


class AttendanceTodayRead(ORMModel):
    attendance_date: date
    assignment: ShiftAssignmentRead | None
    template: ShiftTemplateRead | None
    log: AttendanceLogRead | None
    can_check_in: bool
    can_check_out: bool
    message: str


class AttendanceDashboardRead(ORMModel):
    attendance_date: date
    total_records: int
    present: int
    scheduled: int
    checked_in: int
    checked_out: int
    absent: int
    late: int
    on_leave: int
    holidays: int
    weekends: int
    logs: list[AttendanceLogRead]


class HotelHolidayCreate(ORMModel):
    date: date
    title: str = Field(min_length=1, max_length=180)


class HotelHolidayRead(ORMModel):
    id: str
    hotel_id: str
    date: date
    title: str
    created_at: datetime


class AttendanceFinalizePayload(ORMModel):
    attendance_date: date


class AttendanceFinalizeRead(ORMModel):
    attendance_date: date
    created: int
    skipped: int

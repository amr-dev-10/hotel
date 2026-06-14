from datetime import date, datetime, time

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ShiftCreate(BaseModel):
    user_id: str
    department_id: str | None = None
    shift_date: date
    shift_start: time
    shift_end: time
    shift_type: str = "custom"
    status: str = "scheduled"
    notes: str | None = None


class ShiftBulkItem(BaseModel):
    user_id: str
    department_id: str | None = None
    department: str | None = None
    dates: list[date] = Field(default_factory=list)
    type: str = "morning"
    shift_start: time = time(9, 0)
    shift_end: time = time(17, 0)


class ShiftBulkCreate(BaseModel):
    week_start: date
    shifts: list[ShiftBulkItem] = Field(default_factory=list)


class ShiftUpdate(BaseModel):
    status: str | None = None
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    notes: str | None = None


class ShiftRead(ORMModel):
    id: str
    hotel_id: str
    user_id: str
    department_id: str | None = None
    shift_date: date
    shift_start: time
    shift_end: time
    shift_type: str
    status: str
    actual_start: datetime | None = None
    actual_end: datetime | None = None
    notes: str | None = None
    created_by: str | None = None
    created_at: datetime

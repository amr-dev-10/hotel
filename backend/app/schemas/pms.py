from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class HousekeepingCreate(BaseModel):
    room_id: str
    assigned_to: str | None = None
    task_type: str = "daily_clean"
    scheduled_date: date
    scheduled_time: str | None = None
    status: str = "pending"
    priority: int = 2
    notes: str | None = None


class HousekeepingUpdate(BaseModel):
    assigned_to: str | None = None
    task_type: str | None = None
    scheduled_date: date | None = None
    scheduled_time: str | None = None
    status: str | None = None
    priority: int | None = None
    notes: str | None = None


class HousekeepingRead(ORMModel):
    id: str
    hotel_id: str
    room_id: str
    assigned_to: str | None = None
    task_type: str
    scheduled_date: date
    scheduled_time: str | None = None
    status: str
    priority: int
    notes: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None


class HousekeepingChecklistUpsert(BaseModel):
    task_type: str = Field(min_length=2, max_length=60)
    items: list[dict | str] = Field(default_factory=list)


class HousekeepingChecklistRead(ORMModel):
    id: str
    hotel_id: str
    task_type: str
    items: list[dict | str]


class MaintenanceCreate(BaseModel):
    room_id: str | None = None
    ticket_id: str | None = None
    reported_by: str | None = None
    assigned_to: str | None = None
    category: str = "other"
    description: str = Field(min_length=1)
    priority: str = "medium"
    status: str = "reported"
    scheduled_date: date | None = None
    parts_used: list[dict] = Field(default_factory=list)
    total_cost: Decimal = Decimal("0")


class MaintenanceUpdate(BaseModel):
    room_id: str | None = None
    assigned_to: str | None = None
    category: str | None = None
    description: str | None = None
    priority: str | None = None
    status: str | None = None
    scheduled_date: date | None = None
    parts_used: list[dict] | None = None
    total_cost: Decimal | None = None


class MaintenanceRead(ORMModel):
    id: str
    hotel_id: str
    room_id: str | None = None
    ticket_id: str | None = None
    reported_by: str | None = None
    assigned_to: str | None = None
    category: str
    description: str
    priority: str
    status: str
    scheduled_date: date | None = None
    completed_at: datetime | None = None
    parts_used: list[dict]
    total_cost: Decimal
    created_at: datetime


class LostFoundCreate(BaseModel):
    type: str = "found"
    item_description: str = Field(min_length=1, max_length=255)
    found_location: str | None = None
    found_by: str | None = None
    guest_id: str | None = None
    photo_url: str | None = None
    status: str = "unclaimed"
    found_date: date | None = None
    claimed_date: date | None = None
    notes: str | None = None


class LostFoundUpdate(BaseModel):
    type: str | None = None
    item_description: str | None = None
    found_location: str | None = None
    found_by: str | None = None
    guest_id: str | None = None
    photo_url: str | None = None
    status: str | None = None
    found_date: date | None = None
    claimed_date: date | None = None
    notes: str | None = None


class LostFoundRead(ORMModel):
    id: str
    hotel_id: str
    type: str
    item_description: str
    found_location: str | None = None
    found_by: str | None = None
    guest_id: str | None = None
    photo_url: str | None = None
    status: str
    found_date: date | None = None
    claimed_date: date | None = None
    notes: str | None = None
    created_at: datetime

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class TicketCreate(BaseModel):
    guest_id: str | None = None
    room_id: str | None = None
    department_id: str | None = None
    department_key: str | None = None
    assigned_to: str | None = None
    type: str = "Ticket"
    task_category: str | None = None
    item_description: str = Field(min_length=2)
    source: str = "dashboard"
    priority: int = Field(default=2, ge=1, le=5)


class TicketStageUpdate(BaseModel):
    stage: str = Field(min_length=2, max_length=40)
    note: str | None = None


class TicketRead(ORMModel):
    id: str
    ticket_code: str
    hotel_id: str
    guest_id: str | None = None
    room_id: str | None = None
    department_id: str | None = None
    assigned_to: str | None = None
    stage: str
    type: str
    task_category: str | None = None
    item_description: str
    source: str
    priority: int
    sla_due_at: datetime | None = None
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class TicketAcceptanceRead(ORMModel):
    id: str
    ticket_id: str
    offered_to: str
    offered_at: datetime
    response: str
    responded_at: datetime | None = None
    auto_expired: bool
    expire_after_minutes: int


class TicketEventRead(ORMModel):
    id: str
    hotel_id: str
    ticket_id: str
    actor_id: str | None = None
    event_type: str
    payload: dict
    created_at: datetime

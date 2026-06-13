from pydantic import BaseModel, Field

from app.modules.ticket.models import TicketPriority, TicketStatus


class TicketCreate(BaseModel):
    workflow_id: str
    title: str = Field(min_length=1, max_length=180)
    description: str | None = None
    priority: TicketPriority = TicketPriority.medium
    assigned_to: str | None = None


class TicketUpdate(BaseModel):
    status: TicketStatus | None = None
    assigned_to: str | None = None


class TicketRead(BaseModel):
    id: str
    tenant_id: str
    workflow_id: str
    title: str
    description: str | None
    priority: TicketPriority
    status: TicketStatus
    assigned_to: str | None
    created_by: str

    model_config = {"from_attributes": True}


class TicketMessageCreate(BaseModel):
    message: str = Field(min_length=1)


class HotelTicketCreate(BaseModel):
    guest_id: str | None = None
    room_id: str | None = None
    department_id: str | None = None
    assigned_to: str | None = None
    stage: str = Field(default="created", max_length=40)
    type: str | None = Field(default=None, max_length=80)
    item_description: str = Field(min_length=1)
    source: str = Field(default="android", max_length=40)
    priority: TicketPriority = TicketPriority.medium


class HotelTicketUpdate(BaseModel):
    guest_id: str | None = None
    room_id: str | None = None
    department_id: str | None = None
    assigned_to: str | None = None
    stage: str | None = Field(default=None, max_length=40)
    type: str | None = Field(default=None, max_length=80)
    item_description: str | None = None
    source: str | None = Field(default=None, max_length=40)
    priority: TicketPriority | None = None


class HotelTicketRead(BaseModel):
    id: str
    hotel_id: str
    ticket_code: str | None
    guest_id: str | None
    room_id: str | None
    department_id: str | None
    assigned_to: str | None
    stage: str
    type: str | None
    item_description: str | None
    source: str
    priority: TicketPriority


class TicketHistoryRead(BaseModel):
    id: str
    hotel_id: str
    ticket_id: str
    from_stage: str | None
    to_stage: str
    changed_by: str | None
    changed_at: str


class TicketAssignRequest(BaseModel):
    assigned_to: str


class HotelTicketMessageCreate(BaseModel):
    sender_type: str = Field(default="staff", max_length=40)
    content: str = Field(min_length=1)


class HotelTicketMessageRead(BaseModel):
    id: str
    hotel_id: str
    ticket_id: str
    sender_type: str
    sender_id: str
    content: str

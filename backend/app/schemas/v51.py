from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class DepartmentStaffNode(BaseModel):
    id: str
    name: str
    staff_level: str | None = None
    reports_to: str | None = None
    on_shift: bool
    open_tickets: int


class SupervisorNode(DepartmentStaffNode):
    attendants: list[DepartmentStaffNode] = Field(default_factory=list)


class DepartmentHierarchyRead(BaseModel):
    department: str
    manager: DepartmentStaffNode | None = None
    supervisors: list[SupervisorNode] = Field(default_factory=list)
    attendants: list[DepartmentStaffNode] = Field(default_factory=list)


class EscalationRuleCreate(BaseModel):
    department_id: str | None = None
    ticket_type: str | None = None
    task_category_id: str | None = None
    task_category: str | None = None
    escalation_level: int = Field(ge=1, le=10)
    trigger_after_minutes: int = Field(ge=0)
    action: str = "escalate_up"
    target_staff_level: str | None = None
    auto_reassign: bool = False
    send_notification: bool = True
    notification_channels: list[str] = Field(default_factory=lambda: ["fcm", "websocket"])
    is_active: bool = True


class EscalationRuleUpdate(BaseModel):
    department_id: str | None = None
    ticket_type: str | None = None
    task_category_id: str | None = None
    task_category: str | None = None
    escalation_level: int | None = Field(default=None, ge=1, le=10)
    trigger_after_minutes: int | None = Field(default=None, ge=0)
    action: str | None = None
    target_staff_level: str | None = None
    auto_reassign: bool | None = None
    send_notification: bool | None = None
    notification_channels: list[str] | None = None
    is_active: bool | None = None


class EscalationRuleRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str | None = None
    ticket_type: str | None = None
    task_category_id: str | None = None
    task_category: str | None = None
    task_category_name: str | None = None
    escalation_level: int
    trigger_after_minutes: int
    action: str
    target_staff_level: str | None = None
    auto_reassign: bool
    send_notification: bool
    notification_channels: list[str]
    is_active: bool
    created_at: datetime


class EscalationLogRead(ORMModel):
    id: str
    ticket_id: str
    rule_id: str
    escalation_level: int
    escalated_from: str | None = None
    escalated_to: str | None = None
    reason: str
    notes: str | None = None
    created_at: datetime


class TaskTypeSLACreate(BaseModel):
    ticket_category_id: str | None = None
    task_category: str = Field(min_length=2, max_length=80)
    sla_minutes: int = Field(gt=0)
    accept_timeout_minutes: int = Field(default=2, gt=0)
    description: str | None = None
    is_active: bool = True


class TaskTypeSLAUpdate(BaseModel):
    ticket_category_id: str | None = None
    task_category: str | None = Field(default=None, min_length=2, max_length=80)
    sla_minutes: int | None = Field(default=None, gt=0)
    accept_timeout_minutes: int | None = Field(default=None, gt=0)
    description: str | None = None
    is_active: bool | None = None


class TaskTypeSLARead(ORMModel):
    id: str
    hotel_id: str
    department_id: str
    ticket_category_id: str | None = None
    task_category: str
    task_category_name: str | None = None
    sla_minutes: int
    accept_timeout_minutes: int
    description: str | None = None
    is_active: bool
    created_at: datetime


class RoutingRuleCreate(BaseModel):
    ticket_type: str = Field(min_length=2, max_length=40)
    target_staff_level: str | None = None
    target_user_id: str | None = None
    skip_normal_assignment: bool = True
    priority_override: int | None = Field(default=None, ge=1, le=5)
    notify_immediately: bool = True
    notification_channels: list[str] = Field(default_factory=lambda: ["fcm", "websocket", "whatsapp"])
    is_active: bool = True


class RoutingRuleUpdate(BaseModel):
    ticket_type: str | None = Field(default=None, min_length=2, max_length=40)
    target_staff_level: str | None = None
    target_user_id: str | None = None
    skip_normal_assignment: bool | None = None
    priority_override: int | None = Field(default=None, ge=1, le=5)
    notify_immediately: bool | None = None
    notification_channels: list[str] | None = None
    is_active: bool | None = None


class RoutingRuleRead(ORMModel):
    id: str
    hotel_id: str
    ticket_type: str
    target_staff_level: str | None = None
    target_user_id: str | None = None
    skip_normal_assignment: bool
    priority_override: int | None = None
    notify_immediately: bool
    notification_channels: list[str]
    is_active: bool
    created_at: datetime


class TicketCategoryRead(ORMModel):
    id: str
    hotel_id: str
    department_id: str | None = None
    key: str
    name: str
    description: str | None = None
    default_priority: int
    sla_minutes: int
    accept_timeout_minutes: int
    is_active: bool
    created_at: datetime
    updated_at: datetime


class AISettingsRead(BaseModel):
    provider: str
    model: str | None = None
    status: str
    last_tested_at: datetime | None = None
    embedding_provider: str | None = None
    embedding_model: str | None = None


class AISettingsUpdate(BaseModel):
    provider: str = Field(min_length=2, max_length=40)
    api_key: str | None = None
    model: str | None = None
    embedding_provider: str | None = None
    embedding_model: str | None = None


class AISettingsTestRead(BaseModel):
    success: bool
    provider: str
    response_time_ms: int
    response_preview: str

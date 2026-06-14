from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class WorkflowStateCreate(BaseModel):
    name: str
    state_key: str
    state_type: str = "intermediate"
    color: str | None = None
    sort_order: int = 0
    required_permission: str | None = None
    auto_assign: bool = False


class WorkflowTransitionCreate(BaseModel):
    from_state_key: str
    to_state_key: str
    trigger_type: str = "manual"
    required_permission: str | None = None
    auto_timer_minutes: int | None = None
    notify_roles: list[str] = Field(default_factory=list)


class WorkflowCreate(BaseModel):
    name: str
    entity_type: str = "ticket"
    is_default: bool = True
    is_active: bool = True
    states: list[WorkflowStateCreate] = Field(default_factory=list)
    transitions: list[WorkflowTransitionCreate] = Field(default_factory=list)


class WorkflowDefinitionRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    entity_type: str
    is_default: bool
    is_active: bool


class WorkflowStateRead(ORMModel):
    id: str
    hotel_id: str
    workflow_id: str
    name: str
    state_key: str
    state_type: str
    color: str | None = None
    sort_order: int
    required_permission: str | None = None
    auto_assign: bool


class WorkflowTransitionRead(ORMModel):
    id: str
    hotel_id: str
    workflow_id: str
    from_state_id: str
    to_state_id: str
    trigger_type: str
    required_permission: str | None = None
    auto_timer_minutes: int | None = None
    notify_roles: list[str]

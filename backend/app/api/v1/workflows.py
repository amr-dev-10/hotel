from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.workflow_repository import (
    WorkflowDefinitionRepository,
    WorkflowStateRepository,
    WorkflowTransitionRepository,
)
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowDefinitionRead,
    WorkflowStateRead,
    WorkflowTransitionRead,
)
from app.services.workflow_service import WorkflowService

router = APIRouter()


@router.get("")
def list_workflows(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("workflow.manage")),
) -> dict:
    workflows = WorkflowDefinitionRepository(db).list_for_hotel(hotel_id)
    return ok([WorkflowDefinitionRead.model_validate(item).model_dump() for item in workflows])


@router.post("")
def create_workflow(
    hotel_id: str,
    payload: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("workflow.manage")),
) -> dict:
    workflow = WorkflowService(db).create(hotel_id, payload, current_user.id)
    return ok(WorkflowDefinitionRead.model_validate(workflow).model_dump())


@router.get("/{workflow_id}/states")
def list_workflow_states(
    hotel_id: str,
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("workflow.manage")),
) -> dict:
    states = WorkflowStateRepository(db).list_for_workflow(workflow_id)
    return ok([WorkflowStateRead.model_validate(item).model_dump() for item in states if item.hotel_id == hotel_id])


@router.get("/{workflow_id}/transitions")
def list_workflow_transitions(
    hotel_id: str,
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("workflow.manage")),
) -> dict:
    transitions = WorkflowTransitionRepository(db).list_for_workflow(workflow_id)
    return ok([WorkflowTransitionRead.model_validate(item).model_dump() for item in transitions if item.hotel_id == hotel_id])

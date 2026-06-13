from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.workflow.models import Workflow, WorkflowStage
from app.modules.workflow.schemas import StageCreate, StageRead, WorkflowCreate, WorkflowRead

router = APIRouter(prefix="/workflows", tags=["workflows"])


@router.get("", response_model=list[WorkflowRead])
def list_workflows(
    context: TenantContext = Depends(require_permission("workflow.view")),
    db: Session = Depends(get_db),
) -> list[Workflow]:
    return list(db.scalars(select(Workflow).where(Workflow.tenant_id == str(context.tenant_id))).all())


@router.post("", response_model=WorkflowRead, status_code=201)
def create_workflow(
    payload: WorkflowCreate,
    context: TenantContext = Depends(require_permission("workflow.manage")),
    db: Session = Depends(get_db),
) -> Workflow:
    workflow = Workflow(tenant_id=str(context.tenant_id), **payload.model_dump())
    db.add(workflow)
    db.commit()
    db.refresh(workflow)
    return workflow


@router.post("/stages", response_model=StageRead, status_code=201)
def create_stage(
    payload: StageCreate,
    context: TenantContext = Depends(require_permission("workflow.manage")),
    db: Session = Depends(get_db),
) -> WorkflowStage:
    stage = WorkflowStage(tenant_id=str(context.tenant_id), **payload.model_dump())
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.workflow import WorkflowDefinition, WorkflowState, WorkflowTransition
from app.repositories.base import BaseRepository


class WorkflowDefinitionRepository(BaseRepository[WorkflowDefinition]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WorkflowDefinition)

    def default_for_entity(self, hotel_id: str, entity_type: str) -> WorkflowDefinition | None:
        return self.db.execute(
            select(WorkflowDefinition).where(
                WorkflowDefinition.hotel_id == hotel_id,
                WorkflowDefinition.entity_type == entity_type,
                WorkflowDefinition.is_active.is_(True),
                WorkflowDefinition.is_default.is_(True),
            )
        ).scalar_one_or_none()


class WorkflowStateRepository(BaseRepository[WorkflowState]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WorkflowState)

    def get_by_key(self, workflow_id: str, state_key: str) -> WorkflowState | None:
        return self.db.execute(
            select(WorkflowState).where(
                WorkflowState.workflow_id == workflow_id,
                WorkflowState.state_key == state_key,
            )
        ).scalar_one_or_none()

    def list_for_workflow(self, workflow_id: str) -> Sequence[WorkflowState]:
        return self.db.execute(
            select(WorkflowState)
            .where(WorkflowState.workflow_id == workflow_id)
            .order_by(WorkflowState.sort_order)
        ).scalars().all()


class WorkflowTransitionRepository(BaseRepository[WorkflowTransition]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, WorkflowTransition)

    def get_transition(
        self,
        workflow_id: str,
        from_state_id: str,
        to_state_id: str,
    ) -> WorkflowTransition | None:
        return self.db.execute(
            select(WorkflowTransition).where(
                WorkflowTransition.workflow_id == workflow_id,
                WorkflowTransition.from_state_id == from_state_id,
                WorkflowTransition.to_state_id == to_state_id,
            )
        ).scalar_one_or_none()

    def list_for_workflow(self, workflow_id: str) -> Sequence[WorkflowTransition]:
        return self.db.execute(
            select(WorkflowTransition).where(WorkflowTransition.workflow_id == workflow_id)
        ).scalars().all()

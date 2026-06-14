from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, forbidden, not_found
from app.models.ticket import Ticket
from app.models.workflow import WorkflowDefinition, WorkflowState, WorkflowTransition
from app.repositories.ticket_repository import TicketRepository
from app.repositories.workflow_repository import (
    WorkflowDefinitionRepository,
    WorkflowStateRepository,
    WorkflowTransitionRepository,
)
from app.schemas.workflow import WorkflowCreate
from app.services.audit_service import AuditService
from app.services.rbac_service import RBACService


class WorkflowService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.workflows = WorkflowDefinitionRepository(db)
        self.states = WorkflowStateRepository(db)
        self.transitions = WorkflowTransitionRepository(db)

    def create(self, hotel_id: str, payload: WorkflowCreate, actor_id: str | None) -> WorkflowDefinition:
        workflow = WorkflowDefinition(
            hotel_id=hotel_id,
            name=payload.name,
            entity_type=payload.entity_type,
            is_default=payload.is_default,
            is_active=payload.is_active,
        )
        self.db.add(workflow)
        self.db.flush()
        if workflow.is_default:
            self._clear_other_defaults(hotel_id, workflow.entity_type, workflow.id)
        state_by_key: dict[str, WorkflowState] = {}
        for state_payload in payload.states:
            state = WorkflowState(
                hotel_id=hotel_id,
                workflow_id=workflow.id,
                **state_payload.model_dump(),
            )
            self.db.add(state)
            self.db.flush()
            state_by_key[state.state_key] = state
        for transition_payload in payload.transitions:
            from_state = state_by_key.get(transition_payload.from_state_key)
            to_state = state_by_key.get(transition_payload.to_state_key)
            if not from_state or not to_state:
                raise bad_request("Workflow transition references an unknown state")
            self.db.add(
                WorkflowTransition(
                    hotel_id=hotel_id,
                    workflow_id=workflow.id,
                    from_state_id=from_state.id,
                    to_state_id=to_state.id,
                    trigger_type=transition_payload.trigger_type,
                    required_permission=transition_payload.required_permission,
                    auto_timer_minutes=transition_payload.auto_timer_minutes,
                    notify_roles=transition_payload.notify_roles,
                )
            )
        AuditService(self.db).log(hotel_id, "workflow.created", "workflow", workflow.id, actor_id)
        self.db.commit()
        self.db.refresh(workflow)
        return workflow

    def change_ticket_stage(self, ticket: Ticket, new_state_key: str, actor) -> Ticket | None:
        workflow = self.workflows.default_for_entity(ticket.hotel_id, "ticket")
        if not workflow:
            return None
        current_key = ticket.stage.lower().replace(" ", "_")
        current_state = self.states.get_by_key(workflow.id, current_key)
        target_state = self.states.get_by_key(workflow.id, new_state_key)
        if not target_state:
            target_state = self.states.get_by_key(workflow.id, new_state_key.lower().replace(" ", "_"))
        if not target_state:
            raise not_found("Workflow target state not found")
        if not current_state:
            initial_states = [
                state for state in self.states.list_for_workflow(workflow.id) if state.state_type == "initial"
            ]
            current_state = initial_states[0] if initial_states else None
        transition = None
        if current_state:
            transition = self.transitions.get_transition(workflow.id, current_state.id, target_state.id)
        if current_state and not transition:
            raise bad_request(f"Cannot move from {ticket.stage} to {target_state.state_key}")
        required_permission = (
            transition.required_permission if transition else target_state.required_permission
        )
        if required_permission and actor and not actor.is_hotel_owner:
            permissions = RBACService(self.db).permission_codes_for_user(actor)
            if required_permission not in permissions:
                raise forbidden(f"Missing permission: {required_permission}")
        old_stage = ticket.stage
        ticket.stage = target_state.state_key
        if target_state.state_type == "terminal":
            from app.models.base import utcnow

            ticket.resolved_at = ticket.resolved_at or utcnow()
        TicketRepository(self.db).add_event(
            ticket,
            "stage_changed",
            {"from": old_stage, "to": target_state.state_key, "workflow_id": workflow.id},
            actor_id=actor.id if actor else None,
        )
        return ticket

    def _clear_other_defaults(self, hotel_id: str, entity_type: str, keep_id: str) -> None:
        for workflow in self.workflows.list_for_hotel(hotel_id, limit=500):
            if workflow.entity_type == entity_type and workflow.id != keep_id and workflow.is_default:
                workflow.is_default = False

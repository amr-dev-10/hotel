from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.permissions import Permissions
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.routing_rule_repository import RoutingRuleRepository
from app.schemas.v51 import RoutingRuleCreate, RoutingRuleRead, RoutingRuleUpdate
from app.services.routing_service import RoutingRuleService

router = APIRouter()


@router.get("")
def list_routing_rules(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    rules = RoutingRuleRepository(db).list_active(hotel_id)
    return ok([RoutingRuleRead.model_validate(item).model_dump() for item in rules])


@router.post("")
def create_routing_rule(
    hotel_id: str,
    payload: RoutingRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    rule = RoutingRuleService(db).create(hotel_id, payload)
    return ok(RoutingRuleRead.model_validate(rule).model_dump())


@router.put("/{rule_id}")
def update_routing_rule(
    hotel_id: str,
    rule_id: str,
    payload: RoutingRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    rule = RoutingRuleService(db).update(hotel_id, rule_id, payload)
    return ok(RoutingRuleRead.model_validate(rule).model_dump())


@router.delete("/{rule_id}")
def delete_routing_rule(
    hotel_id: str,
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission(Permissions.WORKFLOW_MANAGE)),
) -> dict:
    RoutingRuleService(db).delete(hotel_id, rule_id)
    return ok({"deleted": True, "rule_id": rule_id})

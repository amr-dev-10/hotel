from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.escalation_repository import EscalationRuleRepository
from app.schemas.v51 import EscalationRuleCreate, EscalationRuleRead, EscalationRuleUpdate
from app.services.escalation_service import EscalationRuleService

router = APIRouter()


@router.get("")
def list_escalation_rules(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rules = EscalationRuleRepository(db).list_active(hotel_id)
    return ok([EscalationRuleRead.model_validate(item).model_dump() for item in rules])


@router.post("")
def create_escalation_rule(
    hotel_id: str,
    payload: EscalationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rule = EscalationRuleService(db).create(hotel_id, payload)
    return ok(EscalationRuleRead.model_validate(rule).model_dump())


@router.put("/{rule_id}")
def update_escalation_rule(
    hotel_id: str,
    rule_id: str,
    payload: EscalationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rule = EscalationRuleService(db).update(hotel_id, rule_id, payload)
    return ok(EscalationRuleRead.model_validate(rule).model_dump())


@router.delete("/{rule_id}")
def delete_escalation_rule(
    hotel_id: str,
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    EscalationRuleService(db).delete(hotel_id, rule_id)
    return ok({"deleted": True, "rule_id": rule_id})

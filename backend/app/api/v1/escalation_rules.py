from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.escalation_repository import EscalationRuleRepository
from app.repositories.ticket_category_repository import TicketCategoryRepository
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
    category_names = _category_names(db, hotel_id, [item.task_category_id for item in rules])
    return ok([_rule_read(item, category_names).model_dump() for item in rules])


@router.post("")
def create_escalation_rule(
    hotel_id: str,
    payload: EscalationRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rule = EscalationRuleService(db).create(hotel_id, payload)
    return ok(_rule_read(rule, _category_names(db, hotel_id, [rule.task_category_id])).model_dump())


@router.put("/{rule_id}")
def update_escalation_rule(
    hotel_id: str,
    rule_id: str,
    payload: EscalationRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rule = EscalationRuleService(db).update(hotel_id, rule_id, payload)
    return ok(_rule_read(rule, _category_names(db, hotel_id, [rule.task_category_id])).model_dump())


@router.delete("/{rule_id}")
def delete_escalation_rule(
    hotel_id: str,
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    EscalationRuleService(db).delete(hotel_id, rule_id)
    return ok({"deleted": True, "rule_id": rule_id})


@router.post("/reset-defaults")
def reset_default_escalation_rules(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    rows = EscalationRuleService(db).reset_defaults(hotel_id)
    category_names = _category_names(db, hotel_id, [item.task_category_id for item in rows])
    return ok([_rule_read(item, category_names).model_dump() for item in rows])


def _rule_read(rule, category_names: dict[str, str]) -> EscalationRuleRead:
    return EscalationRuleRead.model_validate(rule).model_copy(
        update={"task_category_name": category_names.get(rule.task_category_id or "")}
    )


def _category_names(db: Session, hotel_id: str, category_ids: list[str | None]) -> dict[str, str]:
    ids = {category_id for category_id in category_ids if category_id}
    if not ids:
        return {}
    rows = TicketCategoryRepository(db).list_active(hotel_id)
    return {row.id: row.name for row in rows if row.id in ids}

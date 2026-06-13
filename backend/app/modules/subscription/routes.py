from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import PlatformContext, require_platform_context
from app.modules.subscription.models import Plan
from app.modules.subscription.schemas import PlanCreate, PlanRead

router = APIRouter(prefix="/platform/plans", tags=["platform subscriptions"])


@router.get("", response_model=list[PlanRead])
def list_plans(_: PlatformContext = Depends(require_platform_context), db: Session = Depends(get_db)) -> list[Plan]:
    return list(db.scalars(select(Plan).order_by(Plan.name)).all())


@router.post("", response_model=PlanRead, status_code=201)
def create_plan(
    payload: PlanCreate,
    _: PlatformContext = Depends(require_platform_context),
    db: Session = Depends(get_db),
) -> Plan:
    plan = Plan(**payload.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

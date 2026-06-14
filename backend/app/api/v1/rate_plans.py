from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.rate_plan_repository import RatePlanPeriodRepository, RatePlanRepository
from app.schemas.rate_plan import (
    RatePlanCreate,
    RatePlanPeriodCreate,
    RatePlanPeriodRead,
    RatePlanRead,
    RatePlanUpdate,
)
from app.services.rate_plan_service import RatePlanService

router = APIRouter()


@router.get("")
def list_rate_plans(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.view")),
) -> dict:
    plans = RatePlanRepository(db).list_for_hotel(hotel_id)
    return ok([RatePlanRead.model_validate(item).model_dump() for item in plans])


@router.post("")
def create_rate_plan(
    hotel_id: str,
    payload: RatePlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    plan = RatePlanService(db).create(hotel_id, payload, current_user.id)
    return ok(RatePlanRead.model_validate(plan).model_dump())


@router.put("/{rate_plan_id}")
def update_rate_plan(
    hotel_id: str,
    rate_plan_id: str,
    payload: RatePlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    plan = RatePlanService(db).update(hotel_id, rate_plan_id, payload, current_user.id)
    return ok(RatePlanRead.model_validate(plan).model_dump())


@router.get("/{rate_plan_id}/periods")
def list_rate_plan_periods(
    hotel_id: str,
    rate_plan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("room.view")),
) -> dict:
    periods = RatePlanPeriodRepository(db).list_for_plan(hotel_id, rate_plan_id)
    return ok([RatePlanPeriodRead.model_validate(item).model_dump() for item in periods])


@router.post("/{rate_plan_id}/periods")
def create_rate_plan_period(
    hotel_id: str,
    rate_plan_id: str,
    payload: RatePlanPeriodCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    period = RatePlanService(db).add_period(hotel_id, rate_plan_id, payload, current_user.id)
    return ok(RatePlanPeriodRead.model_validate(period).model_dump())

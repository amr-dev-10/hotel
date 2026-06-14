from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.saas_repository import FeatureRepository, PlanFeatureRepository, UsageLimitRepository
from app.schemas.saas import (
    FeatureCreate,
    FeatureRead,
    PlanFeatureRead,
    PlanFeatureUpsert,
    UsageLimitRead,
)
from app.services.usage_service import FeatureService, UsageService

router = APIRouter()


@router.get("/features")
def list_features(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.manage")),
) -> dict:
    FeatureService(db).seed_defaults()
    db.commit()
    features = FeatureRepository(db).list_all()
    return ok([FeatureRead.model_validate(item).model_dump() for item in features])


@router.post("/features")
def create_feature(
    hotel_id: str,
    payload: FeatureCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.manage")),
) -> dict:
    feature = FeatureService(db).create_feature(payload)
    return ok(FeatureRead.model_validate(feature).model_dump())


@router.get("/plan-features")
def list_plan_features(
    hotel_id: str,
    plan: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.manage")),
) -> dict:
    FeatureService(db).seed_defaults()
    db.commit()
    features = PlanFeatureRepository(db).list_all(plan)
    return ok([PlanFeatureRead.model_validate(item).model_dump() for item in features])


@router.put("/plan-features")
def upsert_plan_feature(
    hotel_id: str,
    payload: PlanFeatureUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.manage")),
) -> dict:
    plan_feature = FeatureService(db).upsert_plan_feature(payload)
    return ok(PlanFeatureRead.model_validate(plan_feature).model_dump())


@router.get("/usage-limits")
def list_usage_limits(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.manage")),
) -> dict:
    rows = UsageLimitRepository(db).list_for_hotel(hotel_id)
    return ok([UsageLimitRead.model_validate(item).model_dump() for item in rows])


@router.post("/usage-limits/reset")
def reset_usage_limits(
    hotel_id: str,
    period: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("feature.manage")),
) -> dict:
    rows = UsageService(db).reset_monthly_usage(hotel_id, period)
    return ok([UsageLimitRead.model_validate(item).model_dump() for item in rows])

from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.saas import Feature, PlanFeature, UsageLimit
from app.repositories.base import BaseRepository


class FeatureRepository(BaseRepository[Feature]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Feature)

    def get_by_code(self, code: str) -> Feature | None:
        return self.db.execute(select(Feature).where(Feature.code == code)).scalar_one_or_none()

    def list_all(self) -> Sequence[Feature]:
        return self.db.execute(select(Feature).order_by(Feature.module, Feature.code)).scalars().all()


class PlanFeatureRepository(BaseRepository[PlanFeature]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, PlanFeature)

    def get_for_plan(self, plan: str, feature_id: str) -> PlanFeature | None:
        return self.db.execute(
            select(PlanFeature).where(
                PlanFeature.plan == plan,
                PlanFeature.feature_id == feature_id,
            )
        ).scalar_one_or_none()

    def list_all(self, plan: str | None = None) -> Sequence[PlanFeature]:
        statement = select(PlanFeature)
        if plan:
            statement = statement.where(PlanFeature.plan == plan)
        return self.db.execute(statement.order_by(PlanFeature.plan, PlanFeature.feature_id)).scalars().all()


class UsageLimitRepository(BaseRepository[UsageLimit]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, UsageLimit)

    def get_current(self, hotel_id: str, feature_code: str, period: str) -> UsageLimit | None:
        return self.db.execute(
            select(UsageLimit).where(
                UsageLimit.hotel_id == hotel_id,
                UsageLimit.feature_code == feature_code,
                UsageLimit.period == period,
            )
        ).scalar_one_or_none()

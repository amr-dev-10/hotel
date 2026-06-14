from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rate_plan import RatePlan, RatePlanPeriod
from app.repositories.base import BaseRepository


class RatePlanRepository(BaseRepository[RatePlan]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RatePlan)

    def default_for_room_type(self, hotel_id: str, room_type_id: str) -> RatePlan | None:
        return self.db.execute(
            select(RatePlan).where(
                RatePlan.hotel_id == hotel_id,
                RatePlan.room_type_id == room_type_id,
                RatePlan.is_default.is_(True),
                RatePlan.is_active.is_(True),
            )
        ).scalar_one_or_none()


class RatePlanPeriodRepository(BaseRepository[RatePlanPeriod]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RatePlanPeriod)

    def list_for_plan(self, hotel_id: str, rate_plan_id: str) -> Sequence[RatePlanPeriod]:
        return self.db.execute(
            select(RatePlanPeriod)
            .where(
                RatePlanPeriod.hotel_id == hotel_id,
                RatePlanPeriod.rate_plan_id == rate_plan_id,
            )
            .order_by(RatePlanPeriod.start_date, RatePlanPeriod.name)
        ).scalars().all()

    def active_for_date(
        self,
        hotel_id: str,
        rate_plan_id: str,
        target_date: date,
    ) -> RatePlanPeriod | None:
        weekday = target_date.strftime("%a").lower()[:3]
        periods = self.list_for_plan(hotel_id, rate_plan_id)
        for period in periods:
            if period.start_date and target_date < period.start_date:
                continue
            if period.end_date and target_date > period.end_date:
                continue
            if period.day_of_week and weekday not in {item.lower()[:3] for item in period.day_of_week}:
                continue
            return period
        return None

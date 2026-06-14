from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.rate_plan import RatePlan, RatePlanPeriod
from app.models.reservation import Reservation
from app.models.room import RoomType
from app.repositories.rate_plan_repository import RatePlanPeriodRepository, RatePlanRepository
from app.repositories.room_repository import RoomTypeRepository
from app.schemas.rate_plan import RatePlanCreate, RatePlanPeriodCreate, RatePlanUpdate
from app.services.audit_service import AuditService


class RatePlanService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.rate_plans = RatePlanRepository(db)
        self.periods = RatePlanPeriodRepository(db)
        self.room_types = RoomTypeRepository(db)
        self.audit = AuditService(db)

    def create(
        self,
        hotel_id: str,
        payload: RatePlanCreate,
        actor_id: str | None,
    ) -> RatePlan:
        if not self.room_types.get_for_hotel(hotel_id, payload.room_type_id):
            raise not_found("Room type not found")
        plan = RatePlan(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(plan)
        self.db.flush()
        if plan.is_default:
            self._clear_other_defaults(hotel_id, plan.room_type_id, plan.id)
        self.audit.log(hotel_id, "rate_plan.created", "rate_plan", plan.id, actor_id)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def update(
        self,
        hotel_id: str,
        rate_plan_id: str,
        payload: RatePlanUpdate,
        actor_id: str | None,
    ) -> RatePlan:
        plan = self.rate_plans.get_for_hotel(hotel_id, rate_plan_id)
        if not plan:
            raise not_found("Rate plan not found")
        data = payload.model_dump(exclude_unset=True)
        if data.get("room_type_id") and not self.room_types.get_for_hotel(hotel_id, data["room_type_id"]):
            raise not_found("Room type not found")
        for key, value in data.items():
            setattr(plan, key, value)
        if plan.is_default:
            self._clear_other_defaults(hotel_id, plan.room_type_id, plan.id)
        self.audit.log(hotel_id, "rate_plan.updated", "rate_plan", plan.id, actor_id)
        self.db.commit()
        self.db.refresh(plan)
        return plan

    def add_period(
        self,
        hotel_id: str,
        rate_plan_id: str,
        payload: RatePlanPeriodCreate,
        actor_id: str | None,
    ) -> RatePlanPeriod:
        if not self.rate_plans.get_for_hotel(hotel_id, rate_plan_id):
            raise not_found("Rate plan not found")
        period = RatePlanPeriod(
            hotel_id=hotel_id,
            rate_plan_id=rate_plan_id,
            **payload.model_dump(),
        )
        self.db.add(period)
        self.audit.log(hotel_id, "rate_plan.period.created", "rate_plan", rate_plan_id, actor_id)
        self.db.commit()
        self.db.refresh(period)
        return period

    def get_effective_rate(
        self,
        hotel_id: str,
        reservation: Reservation | None,
        room_type: RoomType,
        target_date: date,
    ) -> Decimal:
        plan = None
        if reservation and reservation.rate_plan_id:
            plan = self.rate_plans.get_for_hotel(hotel_id, reservation.rate_plan_id)
        if not plan:
            plan = self.rate_plans.default_for_room_type(hotel_id, room_type.id)
        if not plan:
            return Decimal(room_type.base_price or 0)

        period = self.periods.active_for_date(hotel_id, plan.id, target_date)
        if period:
            if period.price_override is not None:
                return Decimal(period.price_override)
            if period.multiplier is not None:
                return Decimal(plan.base_price or 0) * Decimal(period.multiplier)
        return Decimal(plan.base_price or 0)

    def _clear_other_defaults(self, hotel_id: str, room_type_id: str, keep_id: str) -> None:
        for plan in self.rate_plans.list_for_hotel(hotel_id, limit=500):
            if plan.room_type_id == room_type_id and plan.id != keep_id and plan.is_default:
                plan.is_default = False

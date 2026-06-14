from datetime import datetime

from sqlalchemy.orm import Session

from app.core.exceptions import forbidden
from app.models.base import utcnow
from app.models.saas import Feature, PlanFeature, UsageLimit
from app.repositories.hotel_repository import HotelRepository
from app.repositories.saas_repository import FeatureRepository, PlanFeatureRepository, UsageLimitRepository
from app.schemas.saas import FeatureCreate, PlanFeatureUpsert
from app.services.defaults import DEFAULT_FEATURES, DEFAULT_PLAN_FEATURES


class FeatureService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.features = FeatureRepository(db)
        self.plan_features = PlanFeatureRepository(db)

    def seed_defaults(self) -> None:
        for code, name, module, description in DEFAULT_FEATURES:
            feature = self.features.get_by_code(code)
            if not feature:
                feature = Feature(code=code, name=name, module=module, description=description)
                self.db.add(feature)
                self.db.flush()
        for plan, mapping in DEFAULT_PLAN_FEATURES.items():
            for code, (is_enabled, limit_value, limit_unit) in mapping.items():
                feature = self.features.get_by_code(code)
                if not feature:
                    continue
                plan_feature = self.plan_features.get_for_plan(plan, feature.id)
                if not plan_feature:
                    self.db.add(
                        PlanFeature(
                            plan=plan,
                            feature_id=feature.id,
                            is_enabled=is_enabled,
                            limit_value=limit_value,
                            limit_unit=limit_unit,
                        )
                    )
        self.db.flush()

    def create_feature(self, payload: FeatureCreate) -> Feature:
        feature = self.features.get_by_code(payload.code)
        if not feature:
            feature = Feature(**payload.model_dump())
            self.db.add(feature)
        else:
            feature.name = payload.name
            feature.module = payload.module
            feature.description = payload.description
        self.db.commit()
        self.db.refresh(feature)
        return feature

    def upsert_plan_feature(self, payload: PlanFeatureUpsert) -> PlanFeature:
        self.seed_defaults()
        feature = self.features.get_by_code(payload.feature_code)
        if not feature:
            feature = Feature(
                code=payload.feature_code,
                name=payload.feature_code.replace("_", " ").title(),
                module="custom",
            )
            self.db.add(feature)
            self.db.flush()
        plan_feature = self.plan_features.get_for_plan(payload.plan, feature.id)
        if not plan_feature:
            plan_feature = PlanFeature(
                plan=payload.plan,
                feature_id=feature.id,
                is_enabled=payload.is_enabled,
                limit_value=payload.limit_value,
                limit_unit=payload.limit_unit,
            )
            self.db.add(plan_feature)
        else:
            plan_feature.is_enabled = payload.is_enabled
            plan_feature.limit_value = payload.limit_value
            plan_feature.limit_unit = payload.limit_unit
        self.db.commit()
        self.db.refresh(plan_feature)
        return plan_feature

    def plan_feature(self, plan: str, feature_code: str) -> PlanFeature | None:
        self.seed_defaults()
        feature = self.features.get_by_code(feature_code)
        if not feature:
            return None
        return self.plan_features.get_for_plan(plan, feature.id)

    def is_enabled(self, plan: str, feature_code: str) -> bool:
        plan_feature = self.plan_feature(plan, feature_code)
        return bool(plan_feature and plan_feature.is_enabled)


class UsageService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.hotels = HotelRepository(db)
        self.usage = UsageLimitRepository(db)
        self.features = FeatureService(db)

    def check_and_increment(
        self,
        hotel_id: str,
        feature_code: str,
        amount: int = 1,
        commit: bool = False,
    ) -> UsageLimit:
        hotel = self.hotels.get(hotel_id)
        plan = hotel.subscription_tier if hotel else "starter"
        plan_feature = self.features.plan_feature(plan, feature_code)
        if not plan_feature or not plan_feature.is_enabled:
            raise forbidden(f"Feature '{feature_code}' requires plan upgrade")
        period = datetime.now().strftime("%Y-%m")
        usage = self.usage.get_current(hotel_id, feature_code, period)
        if not usage:
            usage = UsageLimit(
                hotel_id=hotel_id,
                feature_code=feature_code,
                period=period,
                limit_value=plan_feature.limit_value,
                used_value=0,
                updated_at=utcnow(),
            )
            self.db.add(usage)
            self.db.flush()
        if usage.limit_value is not None and usage.used_value + amount > usage.limit_value:
            raise forbidden(
                f"Monthly limit reached for {feature_code}: {usage.used_value}/{usage.limit_value}"
            )
        usage.used_value += amount
        usage.updated_at = utcnow()
        if commit:
            self.db.commit()
            self.db.refresh(usage)
        return usage

    def reset_monthly_usage(self, hotel_id: str, period: str | None = None) -> list[UsageLimit]:
        hotel = self.hotels.get(hotel_id)
        plan = hotel.subscription_tier if hotel else "starter"
        period = period or datetime.now().strftime("%Y-%m")
        self.features.seed_defaults()
        rows: list[UsageLimit] = []
        for code, *_ in DEFAULT_FEATURES:
            plan_feature = self.features.plan_feature(plan, code)
            if not plan_feature:
                continue
            usage = self.usage.get_current(hotel_id, code, period)
            if not usage:
                usage = UsageLimit(
                    hotel_id=hotel_id,
                    feature_code=code,
                    period=period,
                    limit_value=plan_feature.limit_value,
                    used_value=0,
                    updated_at=utcnow(),
                )
                self.db.add(usage)
            else:
                usage.limit_value = plan_feature.limit_value
                usage.used_value = 0
                usage.updated_at = utcnow()
            rows.append(usage)
        self.db.commit()
        return rows

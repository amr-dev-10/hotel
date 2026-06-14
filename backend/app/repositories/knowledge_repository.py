from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.knowledge import (
    BotVersion,
    DepartmentConfig,
    HotelFAQ,
    HotelLanguage,
    ServiceForm,
    ServiceFormField,
)
from app.repositories.base import BaseRepository


class FAQRepository(BaseRepository[HotelFAQ]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, HotelFAQ)

    def list_active(self, hotel_id: str) -> Sequence[HotelFAQ]:
        return self.db.execute(
            select(HotelFAQ).where(HotelFAQ.hotel_id == hotel_id, HotelFAQ.is_active.is_(True))
        ).scalars().all()


class BotVersionRepository(BaseRepository[BotVersion]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, BotVersion)

    def next_version(self, hotel_id: str) -> int:
        current = self.db.execute(
            select(func.max(BotVersion.version)).where(BotVersion.hotel_id == hotel_id)
        ).scalar()
        return int(current or 0) + 1


class HotelLanguageRepository(BaseRepository[HotelLanguage]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, HotelLanguage)


class DepartmentConfigRepository(BaseRepository[DepartmentConfig]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, DepartmentConfig)

    def get_for_department(self, hotel_id: str, department_id: str) -> DepartmentConfig | None:
        return self.db.execute(
            select(DepartmentConfig).where(
                DepartmentConfig.hotel_id == hotel_id,
                DepartmentConfig.department_id == department_id,
            )
        ).scalar_one_or_none()


class ServiceFormRepository(BaseRepository[ServiceForm]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, ServiceForm)

    def find_for_service(
        self,
        hotel_id: str,
        service_id: str | None,
        service_name: str | None,
    ) -> ServiceForm | None:
        statement = select(ServiceForm).where(
            ServiceForm.hotel_id == hotel_id,
            ServiceForm.is_active.is_(True),
        )
        if service_id:
            found = self.db.execute(
                statement.where(ServiceForm.service_id == service_id)
            ).scalar_one_or_none()
            if found:
                return found
        if service_name:
            return self.db.execute(
                statement.where(ServiceForm.service_name == service_name)
            ).scalar_one_or_none()
        return None

    def fields_for_form(self, service_form_id: str) -> Sequence[ServiceFormField]:
        return self.db.execute(
            select(ServiceFormField)
            .where(ServiceFormField.service_form_id == service_form_id)
            .order_by(ServiceFormField.sort_order)
        ).scalars().all()

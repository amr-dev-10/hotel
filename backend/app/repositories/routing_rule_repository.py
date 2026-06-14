from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.routing_rule import RoutingRule
from app.repositories.base import BaseRepository


class RoutingRuleRepository(BaseRepository[RoutingRule]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RoutingRule)

    def list_active(self, hotel_id: str) -> Sequence[RoutingRule]:
        return self.db.execute(
            select(RoutingRule)
            .where(RoutingRule.hotel_id == hotel_id, RoutingRule.is_active.is_(True))
            .order_by(RoutingRule.ticket_type)
        ).scalars().all()

    def find_for_type(self, hotel_id: str, ticket_type: str | None) -> RoutingRule | None:
        if not ticket_type:
            return None
        return self.db.execute(
            select(RoutingRule).where(
                RoutingRule.hotel_id == hotel_id,
                RoutingRule.ticket_type == ticket_type.lower(),
                RoutingRule.is_active.is_(True),
            )
        ).scalar_one_or_none()

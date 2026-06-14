from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.routing_rule import RoutingRule
from app.repositories.routing_rule_repository import RoutingRuleRepository
from app.repositories.user_repository import UserRepository
from app.schemas.v51 import RoutingRuleCreate, RoutingRuleUpdate


DEFAULT_ROUTING_RULES = [
    {
        "ticket_type": "complaint",
        "target_staff_level": "admin",
        "priority_override": 1,
        "notification_channels": ["fcm", "websocket", "whatsapp"],
    },
    {
        "ticket_type": "emergency",
        "target_staff_level": "manager",
        "priority_override": 1,
        "notification_channels": ["fcm", "websocket", "whatsapp"],
    },
    {
        "ticket_type": "vip_request",
        "target_staff_level": "manager",
        "priority_override": 1,
        "notification_channels": ["fcm", "websocket"],
    },
]


class RoutingRuleService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.rules = RoutingRuleRepository(db)
        self.users = UserRepository(db)

    def create(self, hotel_id: str, payload: RoutingRuleCreate) -> RoutingRule:
        if payload.target_user_id and not self.users.get_for_hotel(hotel_id, payload.target_user_id):
            raise not_found("Target user not found")
        rule = RoutingRule(hotel_id=hotel_id, **self._normalized(payload.model_dump()))
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def update(self, hotel_id: str, rule_id: str, payload: RoutingRuleUpdate) -> RoutingRule:
        rule = self.rules.get_for_hotel(hotel_id, rule_id)
        if not rule:
            raise not_found("Routing rule not found")
        data = self._normalized(payload.model_dump(exclude_unset=True))
        if data.get("target_user_id") and not self.users.get_for_hotel(hotel_id, data["target_user_id"]):
            raise not_found("Target user not found")
        for key, value in data.items():
            setattr(rule, key, value)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def delete(self, hotel_id: str, rule_id: str) -> None:
        rule = self.rules.get_for_hotel(hotel_id, rule_id)
        if not rule:
            raise not_found("Routing rule not found")
        rule.is_active = False
        self.db.commit()

    def seed_defaults(self, hotel_id: str) -> None:
        for item in DEFAULT_ROUTING_RULES:
            if self.rules.find_for_type(hotel_id, item["ticket_type"]):
                continue
            self.db.add(
                RoutingRule(
                    hotel_id=hotel_id,
                    skip_normal_assignment=True,
                    notify_immediately=True,
                    is_active=True,
                    **item,
                )
            )

    def _normalized(self, data: dict) -> dict:
        if "ticket_type" in data and data["ticket_type"]:
            data["ticket_type"] = data["ticket_type"].lower()
        return data

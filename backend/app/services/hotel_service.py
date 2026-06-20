from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.models.base import utcnow
from app.models.bot_config import BotConfig
from app.models.department import Department
from app.models.hotel import Hotel
from app.models.knowledge import BotVersion, DepartmentConfig, HotelLanguage
from app.models.ops import Subscription
from app.models.rate_plan import RatePlan
from app.models.room import Room, RoomType
from app.models.user import User
from app.models.workflow import WorkflowDefinition, WorkflowState, WorkflowTransition
from app.models.whatsapp import WhatsAppAccount
from app.repositories.hotel_repository import HotelRepository
from app.repositories.user_repository import UserRepository
from app.schemas.hotel import HotelBootstrapRequest
from app.services.auth_service import AuthService
from app.services.defaults import (
    DEFAULT_BOT_MESSAGES,
    DEFAULT_DEPARTMENTS,
    DEFAULT_MAIN_MENU,
    DEFAULT_SERVICES,
    DEFAULT_SLA_CONFIG,
    DEFAULT_TICKET_WORKFLOW,
)
from app.services.rbac_service import RBACService
from app.services.rate_limit_service import RateLimitService
from app.services.escalation_service import EscalationRuleService
from app.services.routing_service import RoutingRuleService
from app.services.sla_service import SLAService
from app.services.usage_service import FeatureService


class HotelService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.hotels = HotelRepository(db)
        self.users = UserRepository(db)

    def bootstrap(self, payload: HotelBootstrapRequest) -> dict:
        if self.hotels.get_by_slug(payload.slug):
            raise bad_request("Hotel slug already exists")
        if self.users.get_by_email(payload.owner_email):
            raise bad_request("Owner email already exists")

        hotel = Hotel(
            slug=payload.slug,
            name=payload.name,
            address=payload.address,
            timezone=payload.timezone,
            contact_email=payload.owner_email,
            contact_phone=payload.contact_phone,
            whatsapp_phone_number_id=payload.whatsapp_phone_number_id,
            subscription_tier="starter",
            status="active",
        )
        self.db.add(hotel)
        self.db.flush()

        owner = User(
            hotel_id=hotel.id,
            name=payload.owner_name,
            email=payload.owner_email,
            hashed_password=AuthService.password_hash(payload.owner_password),
            job_role="Owner",
            user_type="HOTEL_ADMIN",
            staff_level="admin",
            is_hotel_owner=True,
            is_active=True,
            is_on_duty=True,
        )
        self.db.add(owner)
        self.db.flush()
        hotel.owner_user_id = owner.id

        department_ids: dict[str, str] = {}
        for item in DEFAULT_DEPARTMENTS:
            department = Department(hotel_id=hotel.id, **item)
            self.db.add(department)
            self.db.flush()
            department_ids[department.key] = department.id
            self.db.add(
                DepartmentConfig(
                    hotel_id=hotel.id,
                    department_id=department.id,
                    keywords=item["keywords"],
                    sla_minutes=DEFAULT_SLA_CONFIG.get(
                        item["key"],
                        DEFAULT_SLA_CONFIG["default"],
                    ),
                    auto_assignment_enabled=True,
                )
            )

        owner.department_id = department_ids.get("front_office")

        default_room_type = RoomType(
            hotel_id=hotel.id,
            name="Standard",
            description="Default standard room type.",
            max_occupancy=2,
            base_price=0,
            amenities=["WiFi"],
            is_active=True,
            sort_order=10,
        )
        self.db.add(default_room_type)
        self.db.flush()
        self.db.add(
            RatePlan(
                hotel_id=hotel.id,
                name="Room Only",
                description="Default room-only rate plan.",
                room_type_id=default_room_type.id,
                base_price=default_room_type.base_price,
                includes=["wifi"],
                is_default=True,
                is_active=True,
            )
        )

        for room_number in payload.seed_rooms:
            self.db.add(
                Room(
                    hotel_id=hotel.id,
                    room_type_id=default_room_type.id,
                    room_number=room_number,
                    room_type="standard",
                    status="available",
                )
            )

        self.db.add(
            BotConfig(
                hotel_id=hotel.id,
                main_menu=DEFAULT_MAIN_MENU,
                services=DEFAULT_SERVICES,
                messages=DEFAULT_BOT_MESSAGES,
                sla_config=DEFAULT_SLA_CONFIG,
                active_hours={"timezone": payload.timezone},
                gemini_fallback_enabled=True,
            )
        )
        self.db.add(
            HotelLanguage(
                hotel_id=hotel.id,
                default_language="en",
                supported_languages=["en"],
            )
        )
        self.db.add(Subscription(hotel_id=hotel.id, plan="starter", status="active"))

        if payload.whatsapp_phone_number_id:
            self.db.add(
                WhatsAppAccount(
                    hotel_id=hotel.id,
                    business_name=hotel.name,
                    phone_number=payload.contact_phone,
                    phone_number_id=payload.whatsapp_phone_number_id,
                    status="active",
                )
            )
        FeatureService(self.db).seed_defaults()
        RateLimitService(self.db).seed_defaults(hotel.id)
        SLAService(self.db).seed_defaults(hotel.id, department_ids)
        EscalationRuleService(self.db).seed_defaults(hotel.id)
        RoutingRuleService(self.db).seed_defaults(hotel.id)
        self._seed_ticket_workflow(hotel.id)
        RBACService(self.db).seed_owner_role(hotel.id, owner)
        self.db.add(
            BotVersion(
                hotel_id=hotel.id,
                version=1,
                config_json={
                    "main_menu": DEFAULT_MAIN_MENU,
                    "services": DEFAULT_SERVICES,
                    "messages": DEFAULT_BOT_MESSAGES,
                    "sla_config": DEFAULT_SLA_CONFIG,
                },
                published_by=owner.id,
                created_at=utcnow(),
            )
        )

        self.db.commit()
        self.db.refresh(hotel)
        self.db.refresh(owner)
        token = AuthService(self.db).token_for_user(owner)
        return {"hotel": hotel, "owner": owner, **token}

    def _seed_ticket_workflow(self, hotel_id: str) -> None:
        workflow = WorkflowDefinition(
            hotel_id=hotel_id,
            name=DEFAULT_TICKET_WORKFLOW["name"],
            entity_type=DEFAULT_TICKET_WORKFLOW["entity_type"],
            is_default=DEFAULT_TICKET_WORKFLOW["is_default"],
            is_active=True,
        )
        self.db.add(workflow)
        self.db.flush()
        state_by_key: dict[str, WorkflowState] = {}
        for state_data in DEFAULT_TICKET_WORKFLOW["states"]:
            state = WorkflowState(
                hotel_id=hotel_id,
                workflow_id=workflow.id,
                name=state_data["name"],
                state_key=state_data["state_key"],
                state_type=state_data.get("state_type", "intermediate"),
                sort_order=state_data.get("sort_order", 0),
                required_permission=state_data.get("required_permission"),
            )
            self.db.add(state)
            self.db.flush()
            state_by_key[state.state_key] = state
        for transition_data in DEFAULT_TICKET_WORKFLOW["transitions"]:
            from_state = state_by_key[transition_data["from_state_key"]]
            to_state = state_by_key[transition_data["to_state_key"]]
            self.db.add(
                WorkflowTransition(
                    hotel_id=hotel_id,
                    workflow_id=workflow.id,
                    from_state_id=from_state.id,
                    to_state_id=to_state.id,
                    trigger_type=transition_data.get("trigger_type", "manual"),
                    required_permission=transition_data.get("required_permission"),
                    notify_roles=transition_data.get("notify_roles", []),
                )
            )

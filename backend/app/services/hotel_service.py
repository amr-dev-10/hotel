from sqlalchemy.orm import Session

from app.core.exceptions import bad_request
from app.models.bot_config import BotConfig
from app.models.department import Department
from app.models.hotel import Hotel
from app.models.room import Room
from app.models.user import User
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
)


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

        owner.department_id = department_ids.get("front_office")

        for room_number in payload.seed_rooms:
            self.db.add(
                Room(
                    hotel_id=hotel.id,
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

        self.db.commit()
        self.db.refresh(hotel)
        self.db.refresh(owner)
        token = AuthService(self.db).token_for_user(owner)
        return {"hotel": hotel, "owner": owner, **token}

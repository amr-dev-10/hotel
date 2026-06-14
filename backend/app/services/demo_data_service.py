from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import forbidden
from app.core.config import settings
from app.models.base import utcnow
from app.models.department import Department
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.ops import AnalyticsSnapshot, HousekeepingSchedule
from app.models.rate_plan import RatePlan
from app.models.reservation import Reservation, ReservationGuest, ReservationRoomType, StayRecord
from app.models.room import Room, RoomType
from app.models.ticket import Ticket, TicketEvent
from app.models.user import User
from app.repositories.hotel_repository import HotelRepository
from app.repositories.user_repository import UserRepository
from app.schemas.hotel import HotelBootstrapRequest
from app.services.auth_service import AuthService
from app.services.hotel_service import HotelService

DEMO_SLUG = "arcadia-demo"
DEMO_EMAIL = "owner@arcadia.demo"
DEMO_PASSWORD = "DemoPass123!"


class DemoDataService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def seed(self) -> dict:
        if settings.environment.lower() == "production":
            raise forbidden("Demo seed is disabled in production")

        hotel = HotelRepository(self.db).get_by_slug(DEMO_SLUG)
        if not hotel:
            result = HotelService(self.db).bootstrap(
                HotelBootstrapRequest(
                    slug=DEMO_SLUG,
                    name="Arcadia Demo Hotel",
                    owner_name="Demo Owner",
                    owner_email=DEMO_EMAIL,
                    owner_password=DEMO_PASSWORD,
                    address="MG Road, Bengaluru",
                    timezone="Asia/Kolkata",
                    contact_phone="+919900000001",
                    whatsapp_phone_number_id="demo-phone-number-id",
                    seed_rooms=["101", "102", "103", "201", "202", "203", "301", "302"],
                )
            )
            hotel = result["hotel"]

        owner = self._ensure_owner(hotel)
        departments = {item.key: item for item in self.db.query(Department).filter_by(hotel_id=hotel.id).all()}
        rooms = self._ensure_rooms(hotel)
        staff = self._ensure_staff(hotel, departments, owner)
        guests = self._ensure_guests(hotel)
        self._ensure_reservations(hotel, rooms, guests)
        self._ensure_tickets(hotel, departments, rooms, guests, staff, owner)
        self._ensure_housekeeping(hotel, rooms, staff)
        self._ensure_analytics(hotel)

        self.db.commit()
        self.db.refresh(hotel)
        self.db.refresh(owner)
        token = AuthService(self.db).token_for_user(owner)

        return {
            "hotel": hotel,
            "owner": owner,
            "credentials": {
                "email": DEMO_EMAIL,
                "password": DEMO_PASSWORD,
            },
            **token,
        }

    def _ensure_owner(self, hotel: Hotel) -> User:
        user_repo = UserRepository(self.db)
        owner = user_repo.get_by_hotel_email(hotel.id, DEMO_EMAIL)
        if not owner:
            owner = User(
                hotel_id=hotel.id,
                department_id=self._department_id(hotel.id, "front_office"),
                name="Demo Owner",
                email=DEMO_EMAIL,
                hashed_password=AuthService.password_hash(DEMO_PASSWORD),
                job_role="Owner",
                staff_level="admin",
                is_hotel_owner=True,
                is_active=True,
                is_on_duty=True,
            )
            self.db.add(owner)
            self.db.flush()
            hotel.owner_user_id = owner.id
        else:
            owner.hashed_password = AuthService.password_hash(DEMO_PASSWORD)
            owner.is_active = True
            owner.is_hotel_owner = True
            owner.is_on_duty = True
            owner.job_role = "Owner"
            hotel.owner_user_id = owner.id
        return owner

    def _ensure_rooms(self, hotel: Hotel) -> list[Room]:
        room_type = self.db.query(RoomType).filter_by(hotel_id=hotel.id, name="Deluxe").first()
        if not room_type:
            room_type = RoomType(
                hotel_id=hotel.id,
                name="Deluxe",
                description="Demo deluxe room type.",
                max_occupancy=3,
                base_price=Decimal("6500"),
                amenities=["WiFi", "Breakfast", "City view"],
                is_active=True,
                sort_order=20,
            )
            self.db.add(room_type)
            self.db.flush()
            self.db.add(
                RatePlan(
                    hotel_id=hotel.id,
                    name="Breakfast Included",
                    description="Demo breakfast-inclusive rate.",
                    room_type_id=room_type.id,
                    base_price=Decimal("7200"),
                    includes=["wifi", "breakfast"],
                    is_default=False,
                    is_active=True,
                )
            )

        room_rows = [
            ("101", "1", "occupied", "VIP guest, extra towels"),
            ("102", "1", "dirty", "Checkout completed, needs turnover"),
            ("103", "1", "available", None),
            ("201", "2", "maintenance", "AC cooling issue"),
            ("202", "2", "occupied", None),
            ("203", "2", "blocked", "Late checkout hold"),
            ("301", "3", "available", None),
            ("302", "3", "dirty", "Deep clean requested"),
        ]
        rooms: list[Room] = []
        for room_number, floor, status, notes in room_rows:
            room = self.db.query(Room).filter_by(hotel_id=hotel.id, room_number=room_number).first()
            if not room:
                room = Room(
                    hotel_id=hotel.id,
                    room_type_id=room_type.id,
                    room_number=room_number,
                    room_type="deluxe" if room_number.startswith(("2", "3")) else "standard",
                    floor=floor,
                    status=status,
                    notes=notes,
                )
                self.db.add(room)
                self.db.flush()
            else:
                room.floor = room.floor or floor
                room.status = status
                room.notes = notes
            rooms.append(room)
        return rooms

    def _ensure_staff(
        self,
        hotel: Hotel,
        departments: dict[str, Department],
        owner: User,
    ) -> dict[str, User]:
        rows = [
            ("frontdesk@arcadia.demo", "Aarav Front Desk", "Front Office Manager", "manager", "front_office"),
            ("housekeeping@arcadia.demo", "Meera Housekeeping", "Housekeeping Supervisor", "supervisor", "housekeeping"),
            ("attendant@arcadia.demo", "Riya Attendant", "Room Attendant", "attendant", "housekeeping"),
            ("engineering@arcadia.demo", "Kabir Engineering", "Engineering Lead", "supervisor", "engineering"),
        ]
        staff: dict[str, User] = {"owner": owner}
        for email, name, role, level, department_key in rows:
            user = self.db.query(User).filter_by(hotel_id=hotel.id, email=email).first()
            if not user:
                user = User(
                    hotel_id=hotel.id,
                    department_id=departments.get(department_key).id if departments.get(department_key) else None,
                    reports_to=owner.id,
                    staff_level=level,
                    name=name,
                    email=email,
                    hashed_password=AuthService.password_hash(DEMO_PASSWORD),
                    job_role=role,
                    is_hotel_owner=False,
                    is_active=True,
                    is_on_duty=True,
                )
                self.db.add(user)
                self.db.flush()
            else:
                user.hashed_password = AuthService.password_hash(DEMO_PASSWORD)
                user.is_active = True
                user.is_on_duty = True
            staff[department_key] = user
            staff[level] = user
        return staff

    def _ensure_guests(self, hotel: Hotel) -> list[Guest]:
        today = date.today()
        rows = [
            ("Ananya Rao", "+919911000101", "ananya@example.com", today - timedelta(days=1), today + timedelta(days=2), "checked_in"),
            ("Vikram Mehta", "+919911000102", "vikram@example.com", today, today + timedelta(days=1), "reserved"),
            ("Sara Khan", "+919911000103", "sara@example.com", today + timedelta(days=1), today + timedelta(days=4), "reserved"),
            ("Daniel Joseph", "+919911000104", "daniel@example.com", today - timedelta(days=3), today, "checked_out"),
        ]
        guests: list[Guest] = []
        for name, phone, email, checkin, checkout, status in rows:
            guest = self.db.query(Guest).filter_by(hotel_id=hotel.id, phone=phone).first()
            if not guest:
                guest = Guest(
                    hotel_id=hotel.id,
                    name=name,
                    phone=phone,
                    whatsapp_phone=phone,
                    email=email,
                    check_in_date=checkin,
                    check_out_date=checkout,
                    status=status,
                )
                self.db.add(guest)
                self.db.flush()
            else:
                guest.name = name
                guest.email = email
                guest.status = status
                guest.check_in_date = checkin
                guest.check_out_date = checkout
            guests.append(guest)
        return guests

    def _ensure_reservations(self, hotel: Hotel, rooms: list[Room], guests: list[Guest]) -> None:
        today = date.today()
        room_by_number = {room.room_number: room for room in rooms}
        rows = [
            ("DEMO-1001", guests[0], room_by_number["101"], "checked_in", today - timedelta(days=1), today + timedelta(days=2), "direct"),
            ("DEMO-1002", guests[1], room_by_number["202"], "confirmed", today, today + timedelta(days=1), "walk_in"),
            ("DEMO-1003", guests[2], None, "confirmed", today + timedelta(days=1), today + timedelta(days=4), "ota"),
            ("DEMO-1004", guests[3], room_by_number["103"], "checked_out", today - timedelta(days=3), today, "corporate"),
        ]
        default_rate_plan = self.db.query(RatePlan).filter_by(hotel_id=hotel.id, is_default=True).first()
        default_room_type = self.db.query(RoomType).filter_by(hotel_id=hotel.id, name="Standard").first()
        for number, guest, room, status, checkin, checkout, source in rows:
            reservation = self.db.query(Reservation).filter_by(hotel_id=hotel.id, reservation_no=number).first()
            if not reservation:
                reservation = Reservation(
                    hotel_id=hotel.id,
                    reservation_no=number,
                    guest_id=guest.id,
                    room_id=room.id if room else None,
                    rate_plan_id=default_rate_plan.id if default_rate_plan else None,
                    status=status,
                    checkin_date=checkin,
                    checkout_date=checkout,
                    source=source,
                    notes="Demo reservation for dashboard testing",
                )
                self.db.add(reservation)
                self.db.flush()
                self.db.add(
                    ReservationGuest(
                        hotel_id=hotel.id,
                        reservation_id=reservation.id,
                        guest_id=guest.id,
                        is_primary=True,
                        relationship=None,
                    )
                )
                if default_room_type:
                    self.db.add(
                        ReservationRoomType(
                            hotel_id=hotel.id,
                            reservation_id=reservation.id,
                            room_type_id=default_room_type.id,
                            quantity=1,
                            rate_plan_id=default_rate_plan.id if default_rate_plan else None,
                            assigned_room_id=room.id if room else None,
                            assigned_at=utcnow() if room else None,
                        )
                    )
                if status in {"checked_in", "checked_out"}:
                    self.db.add(
                        StayRecord(
                            hotel_id=hotel.id,
                            reservation_id=reservation.id,
                            room_id=room.id if room else None,
                            actual_checkin=utcnow() - timedelta(days=1),
                            actual_checkout=utcnow() if status == "checked_out" else None,
                            notes="Demo stay record",
                        )
                    )
            else:
                reservation.status = status
                reservation.room_id = room.id if room else None

    def _ensure_tickets(
        self,
        hotel: Hotel,
        departments: dict[str, Department],
        rooms: list[Room],
        guests: list[Guest],
        staff: dict[str, User],
        owner: User,
    ) -> None:
        now = utcnow()
        room_by_number = {room.room_number: room for room in rooms}
        rows = [
            ("DEMO-TKT-001", "created", "Extra towels for room 101", "housekeeping", "101", 2, None),
            ("DEMO-TKT-002", "pending_accept", "AC not cooling in room 201", "engineering", "201", 4, staff.get("engineering")),
            ("DEMO-TKT-003", "accepted", "Airport cab request for 7 PM", "front_office", "202", 3, staff.get("front_office")),
            ("DEMO-TKT-004", "in_progress", "Deep clean room 302 before arrival", "housekeeping", "302", 3, staff.get("housekeeping")),
            ("DEMO-TKT-005", "pending_approval", "Guest complaint follow-up completed", "front_office", "101", 5, owner),
            ("DEMO-TKT-006", "approved", "Dinner tray pickup completed", "food_beverage", "202", 1, staff.get("attendant")),
        ]
        for code, stage, description, department_key, room_number, priority, assignee in rows:
            ticket = self.db.query(Ticket).filter_by(hotel_id=hotel.id, ticket_code=code).first()
            department = departments.get(department_key)
            room = room_by_number.get(room_number)
            if not ticket:
                ticket = Ticket(
                    hotel_id=hotel.id,
                    ticket_code=code,
                    guest_id=guests[0].id if guests else None,
                    room_id=room.id if room else None,
                    department_id=department.id if department else None,
                    assigned_to=assignee.id if assignee else None,
                    stage=stage,
                    type="Complaint" if priority >= 5 else "Ticket",
                    task_category=department_key,
                    item_description=description,
                    source="dashboard",
                    priority=priority,
                    sla_due_at=None if stage in {"created", "pending_accept", "approved"} else now + timedelta(minutes=30),
                    resolved_at=now if stage == "approved" else None,
                )
                self.db.add(ticket)
                self.db.flush()
                self.db.add(
                    TicketEvent(
                        hotel_id=hotel.id,
                        ticket_id=ticket.id,
                        actor_id=owner.id,
                        event_type="demo_seeded",
                        payload={"stage": stage},
                        created_at=now,
                    )
                )
            else:
                ticket.stage = stage
                ticket.priority = priority
                ticket.assigned_to = assignee.id if assignee else None

    def _ensure_housekeeping(self, hotel: Hotel, rooms: list[Room], staff: dict[str, User]) -> None:
        today = date.today()
        room_by_number = {room.room_number: room for room in rooms}
        rows = [
            ("101", "daily_clean", today, "10:30", "assigned", 2, "Refresh towels and minibar"),
            ("102", "turnover", today, "12:00", "pending", 4, "Checkout turnover"),
            ("201", "inspection", today, "15:00", "blocked", 5, "Wait for engineering clearance"),
            ("302", "deep_clean", today + timedelta(days=1), "09:00", "pending", 3, "Pre-arrival deep clean"),
        ]
        assignee = staff.get("housekeeping") or staff.get("attendant")
        for room_number, task_type, scheduled_date, scheduled_time, status, priority, notes in rows:
            room = room_by_number.get(room_number)
            if not room:
                continue
            existing = (
                self.db.query(HousekeepingSchedule)
                .filter_by(hotel_id=hotel.id, room_id=room.id, task_type=task_type, scheduled_date=scheduled_date)
                .first()
            )
            if not existing:
                self.db.add(
                    HousekeepingSchedule(
                        hotel_id=hotel.id,
                        room_id=room.id,
                        assigned_to=assignee.id if assignee else None,
                        task_type=task_type,
                        scheduled_date=scheduled_date,
                        scheduled_time=scheduled_time,
                        status=status,
                        priority=priority,
                        notes=notes,
                        started_at=utcnow() if status in {"in_progress", "completed"} else None,
                        completed_at=utcnow() if status == "completed" else None,
                    )
                )
            else:
                existing.status = status
                existing.priority = priority
                existing.notes = notes

    def _ensure_analytics(self, hotel: Hotel) -> None:
        today = date.today()
        for index in range(7):
            snapshot_date = today - timedelta(days=6 - index)
            snapshot = self.db.query(AnalyticsSnapshot).filter_by(hotel_id=hotel.id, snapshot_date=snapshot_date).first()
            occupied_rooms = 3 + (index % 3)
            total_rooms = 8
            revenue_room = Decimal("42000") + Decimal(index * 3500)
            revenue_food = Decimal("9000") + Decimal(index * 800)
            revenue_other = Decimal("2500") + Decimal(index * 350)
            if not snapshot:
                snapshot = AnalyticsSnapshot(hotel_id=hotel.id, snapshot_date=snapshot_date)
                self.db.add(snapshot)
            snapshot.occupancy_rate = Decimal(occupied_rooms) / Decimal(total_rooms)
            snapshot.total_rooms = total_rooms
            snapshot.occupied_rooms = occupied_rooms
            snapshot.total_reservations = 4 + index
            snapshot.new_checkins = 1 + (index % 2)
            snapshot.checkouts = index % 2
            snapshot.ticket_count = 2 + index
            snapshot.avg_resolution_minutes = Decimal("18.5") + Decimal(index)
            snapshot.guest_satisfaction_avg = Decimal("4.2")
            snapshot.revenue_room = revenue_room
            snapshot.revenue_food = revenue_food
            snapshot.revenue_other = revenue_other
            snapshot.revenue_total = revenue_room + revenue_food + revenue_other
            snapshot.whatsapp_messages = 24 + (index * 6)

    def _department_id(self, hotel_id: str, key: str) -> str | None:
        department = self.db.query(Department).filter_by(hotel_id=hotel_id, key=key).first()
        return department.id if department else None

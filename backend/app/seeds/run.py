from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass
from datetime import date, timedelta
from decimal import Decimal
from time import perf_counter
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.exceptions import forbidden
from app.models.base import new_uuid, utcnow
from app.models.department import Department
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.reservation import Reservation, ReservationGuest, StayRecord
from app.models.room import Room, RoomType
from app.models.ticket import Ticket
from app.models.ticket_category import TicketCategory
from app.models.user import User
from app.repositories.hotel_repository import HotelRepository
from app.schemas.hotel import HotelBootstrapRequest
from app.services.auth_service import AuthService
from app.services.demo_data_service import DEMO_PASSWORD, DEMO_SLUG, DemoDataService
from app.services.hotel_service import HotelService


@dataclass(frozen=True)
class SeedPlan:
    size: str
    hotels: int
    rooms: int
    staff: int
    guests: int
    reservations: int
    tickets: int


@dataclass(frozen=True)
class SeedHotelSummary:
    hotel_id: str
    hotel_slug: str


@dataclass(frozen=True)
class SeedSummary:
    hotel_id: str
    hotel_slug: str
    run_id: str
    plan: SeedPlan
    inserted: dict[str, int]
    elapsed_seconds: float
    hotels: list[SeedHotelSummary]


SIZE_PRESETS: dict[str, SeedPlan] = {
    "small": SeedPlan(size="small", hotels=1, rooms=25, staff=12, guests=100, reservations=120, tickets=500),
    "medium": SeedPlan(size="medium", hotels=1, rooms=100, staff=40, guests=1_000, reservations=1_200, tickets=5_000),
    "large": SeedPlan(size="large", hotels=1, rooms=300, staff=120, guests=20_000, reservations=25_000, tickets=100_000),
    "multi": SeedPlan(size="multi", hotels=100, rooms=50, staff=20, guests=1_000, reservations=1_200, tickets=1_000),
}

DEPARTMENT_KEYS = ("front_office", "housekeeping", "engineering", "food_beverage")
TICKET_STAGES = ("created", "pending_accept", "accepted", "in_progress", "pending_approval", "approved")
TICKET_SOURCES = ("DASHBOARD", "WHATSAPP", "GUEST_PORTAL")


def resolve_seed_plan(
    size: str,
    *,
    hotels: int | None = None,
    rooms: int | None = None,
    staff: int | None = None,
    guests: int | None = None,
    reservations: int | None = None,
    tickets: int | None = None,
) -> SeedPlan:
    if size not in SIZE_PRESETS:
        raise ValueError(f"Unknown seed size: {size}")
    preset = SIZE_PRESETS[size]
    plan = SeedPlan(
        size=size,
        hotels=hotels if hotels is not None else preset.hotels,
        rooms=rooms if rooms is not None else preset.rooms,
        staff=staff if staff is not None else preset.staff,
        guests=guests if guests is not None else preset.guests,
        reservations=reservations if reservations is not None else preset.reservations,
        tickets=tickets if tickets is not None else preset.tickets,
    )
    _validate_plan(plan)
    return plan


class LoadSeedService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def seed(self, plan: SeedPlan, *, hotel_slug: str, batch_size: int, dry_run: bool = False) -> SeedSummary:
        if settings.environment.lower() == "production":
            raise forbidden("Load seed is disabled in production")

        started_at = perf_counter()
        run_id = utcnow().strftime("%Y%m%d%H%M%S%f")
        planned_slugs = self._planned_hotel_slugs(hotel_slug, plan.hotels)
        if dry_run:
            return SeedSummary(
                hotel_id="",
                hotel_slug=planned_slugs[0],
                run_id=run_id,
                plan=plan,
                inserted={key: 0 for key in ("hotels", "rooms", "staff", "guests", "reservations", "tickets")},
                elapsed_seconds=round(perf_counter() - started_at, 3),
                hotels=[SeedHotelSummary(hotel_id="", hotel_slug=slug) for slug in planned_slugs],
            )

        hotel_summaries: list[SeedHotelSummary] = []
        inserted = {key: 0 for key in ("hotels", "rooms", "staff", "guests", "reservations", "tickets")}
        for slug in planned_slugs:
            hotel, owner = self._ensure_hotel(slug)
            hotel_summaries.append(SeedHotelSummary(hotel_id=hotel.id, hotel_slug=hotel.slug))
            departments = self._departments_by_key(hotel.id)
            room_ids = self._ensure_rooms(hotel, plan.rooms, batch_size)
            staff_ids = self._ensure_staff(hotel, owner, departments, plan.staff, batch_size)
            category_by_key = self._categories_by_key(hotel.id)
            guest_ids = self._insert_guests(hotel.id, run_id, plan.guests, batch_size)
            reservation_ids = self._insert_reservations(
                hotel.id,
                run_id,
                plan.reservations,
                guest_ids,
                room_ids,
                batch_size,
            )
            self._insert_tickets(
                hotel.id,
                run_id,
                plan.tickets,
                departments,
                category_by_key,
                guest_ids,
                reservation_ids,
                room_ids,
                staff_ids,
                batch_size,
            )
            inserted["hotels"] += 1
            inserted["rooms"] += len(room_ids)
            inserted["staff"] += len(staff_ids)
            inserted["guests"] += plan.guests
            inserted["reservations"] += plan.reservations
            inserted["tickets"] += plan.tickets

        first_hotel = hotel_summaries[0]
        return SeedSummary(
            hotel_id=first_hotel.hotel_id,
            hotel_slug=first_hotel.hotel_slug,
            run_id=run_id,
            plan=plan,
            inserted=inserted,
            elapsed_seconds=round(perf_counter() - started_at, 3),
            hotels=hotel_summaries,
        )

    def _ensure_hotel(self, slug: str) -> tuple[Hotel, User]:
        safe_slug = _safe_slug(slug)
        existing = HotelRepository(self.db).get_by_slug(safe_slug)
        if existing:
            owner = self.db.get(User, existing.owner_user_id) if existing.owner_user_id else None
            if not owner:
                owner = self.db.execute(
                    select(User).where(User.hotel_id == existing.id, User.is_hotel_owner.is_(True))
                ).scalars().first()
            if not owner:
                raise RuntimeError(f"Hotel {safe_slug} has no owner user")
            return existing, owner

        if safe_slug == DEMO_SLUG:
            result = DemoDataService(self.db).seed()
            return result["hotel"], result["owner"]

        result = HotelService(self.db).bootstrap(
            HotelBootstrapRequest(
                slug=safe_slug,
                name=f"{safe_slug.title()} Load Test Hotel",
                owner_name="Load Test Owner",
                owner_email=f"owner-{safe_slug}@arcadia.load",
                owner_password=DEMO_PASSWORD,
                timezone="Asia/Kolkata",
                seed_rooms=["9001", "9002", "9003", "9004"],
            )
        )
        return result["hotel"], result["owner"]

    def _planned_hotel_slugs(self, hotel_slug: str, count: int) -> list[str]:
        safe_slug = _safe_slug(hotel_slug)
        if count == 1:
            return [safe_slug]
        return [_tenant_slug(safe_slug, index) for index in range(1, count + 1)]

    def _departments_by_key(self, hotel_id: str) -> dict[str, Department]:
        rows = self.db.execute(select(Department).where(Department.hotel_id == hotel_id)).scalars().all()
        return {row.key: row for row in rows}

    def _categories_by_key(self, hotel_id: str) -> dict[str, TicketCategory]:
        rows = self.db.execute(select(TicketCategory).where(TicketCategory.hotel_id == hotel_id)).scalars().all()
        return {row.key: row for row in rows}

    def _ensure_rooms(self, hotel: Hotel, count: int, batch_size: int) -> list[str]:
        existing = self.db.execute(select(Room.id).where(Room.hotel_id == hotel.id)).scalars().all()
        if len(existing) >= count:
            return list(existing[:count])

        room_type = self.db.execute(
            select(RoomType).where(RoomType.hotel_id == hotel.id, RoomType.name == "Load Test")
        ).scalars().first()
        if not room_type:
            now = utcnow()
            room_type = RoomType(
                id=new_uuid(),
                hotel_id=hotel.id,
                name="Load Test",
                description="Generated room type for load testing.",
                max_occupancy=3,
                base_price=Decimal("5000"),
                amenities=["WiFi"],
                is_active=True,
                sort_order=99,
                is_deleted=False,
                created_at=now,
                updated_at=now,
            )
            self.db.add(room_type)
            self.db.commit()

        to_create = count - len(existing)
        rows: list[Room] = []
        now = utcnow()
        for index in range(to_create):
            absolute_index = len(existing) + index + 1
            rows.append(
                Room(
                    id=new_uuid(),
                    hotel_id=hotel.id,
                    room_type_id=room_type.id,
                    room_number=f"LOAD-{absolute_index:05d}",
                    room_type="load_test",
                    floor=str((absolute_index // 20) + 1),
                    status="available" if absolute_index % 5 else "occupied",
                    notes="Generated by app.seeds.run",
                    is_deleted=False,
                    created_at=now,
                    updated_at=now,
                )
            )
            self._flush_batch(rows, batch_size)
        self._flush_batch(rows, 1)
        return list(self.db.execute(select(Room.id).where(Room.hotel_id == hotel.id).limit(count)).scalars().all())

    def _ensure_staff(
        self,
        hotel: Hotel,
        owner: User,
        departments: dict[str, Department],
        count: int,
        batch_size: int,
    ) -> list[str]:
        existing = list(
            self.db.execute(
                select(User.id).where(User.hotel_id == hotel.id, User.email.like("load-staff-%@arcadia.load"))
            ).scalars().all()
        )
        if len(existing) >= count:
            return existing[:count]

        password_hash = AuthService.password_hash(DEMO_PASSWORD)
        rows: list[User] = []
        now = utcnow()
        department_values = [departments[key] for key in DEPARTMENT_KEYS if key in departments]
        levels = ("attendant", "supervisor", "manager")
        for index in range(len(existing), count):
            department = department_values[index % len(department_values)] if department_values else None
            level = levels[index % len(levels)]
            rows.append(
                User(
                    id=new_uuid(),
                    hotel_id=hotel.id,
                    department_id=department.id if department else None,
                    reports_to=owner.id,
                    user_type="HOTEL_EMPLOYEE",
                    staff_level=level,
                    name=f"Load Staff {index + 1:04d}",
                    email=f"load-staff-{index + 1:04d}-{hotel.slug}@arcadia.load",
                    hashed_password=password_hash,
                    job_role=f"Load {level.title()}",
                    profile_image_url=None,
                    is_hotel_owner=False,
                    is_active=True,
                    is_on_duty=index % 4 != 0,
                    is_deleted=False,
                    created_at=now,
                    updated_at=now,
                )
            )
            self._flush_batch(rows, batch_size)
        self._flush_batch(rows, 1)
        return list(
            self.db.execute(
                select(User.id).where(User.hotel_id == hotel.id, User.email.like("load-staff-%@arcadia.load")).limit(count)
            ).scalars().all()
        )

    def _insert_guests(self, hotel_id: str, run_id: str, count: int, batch_size: int) -> list[str]:
        guest_ids: list[str] = []
        rows: list[Guest] = []
        today = date.today()
        now = utcnow()
        for index in range(count):
            guest_id = new_uuid()
            guest_ids.append(guest_id)
            check_in = today - timedelta(days=index % 14)
            rows.append(
                Guest(
                    id=guest_id,
                    hotel_id=hotel_id,
                    name=f"Load Guest {index + 1:06d}",
                    phone=f"+9198{run_id[-6:]}{index:06d}",
                    whatsapp_phone=f"9198{run_id[-6:]}{index:06d}",
                    email=f"load-guest-{run_id}-{index:06d}@example.com",
                    check_in_date=check_in,
                    check_out_date=check_in + timedelta(days=1 + (index % 5)),
                    status="checked_in" if index % 3 else "reserved",
                    internal_notes="Generated load-test guest",
                    is_deleted=False,
                    created_at=now - timedelta(minutes=index % 10_080),
                    updated_at=now,
                )
            )
            self._flush_batch(rows, batch_size)
        self._flush_batch(rows, 1)
        return guest_ids

    def _insert_reservations(
        self,
        hotel_id: str,
        run_id: str,
        count: int,
        guest_ids: list[str],
        room_ids: list[str],
        batch_size: int,
    ) -> list[str]:
        reservation_ids: list[str] = []
        reservation_rows: list[Reservation] = []
        guest_rows: list[ReservationGuest] = []
        stay_rows: list[StayRecord] = []
        today = date.today()
        now = utcnow()
        for index in range(count):
            reservation_id = new_uuid()
            guest_id = guest_ids[index % len(guest_ids)]
            room_id = room_ids[index % len(room_ids)] if room_ids else None
            check_in = today + timedelta(days=(index % 30) - 10)
            status = "checked_in" if index % 5 == 0 else "confirmed"
            if index % 11 == 0:
                status = "checked_out"
            reservation_ids.append(reservation_id)
            reservation_rows.append(
                Reservation(
                    id=reservation_id,
                    hotel_id=hotel_id,
                    reservation_no=f"LOAD-RES-{run_id}-{index + 1:07d}",
                    guest_id=guest_id,
                    room_id=room_id,
                    rate_plan_id=None,
                    status=status,
                    checkin_date=check_in,
                    checkout_date=check_in + timedelta(days=1 + (index % 4)),
                    source="load_test",
                    notes="Generated load-test reservation",
                    is_deleted=False,
                    created_at=now - timedelta(minutes=index % 10_080),
                    updated_at=now,
                )
            )
            guest_rows.append(
                ReservationGuest(
                    id=new_uuid(),
                    hotel_id=hotel_id,
                    reservation_id=reservation_id,
                    guest_id=guest_id,
                    is_primary=True,
                )
            )
            if status in {"checked_in", "checked_out"}:
                stay_rows.append(
                    StayRecord(
                        id=new_uuid(),
                        hotel_id=hotel_id,
                        reservation_id=reservation_id,
                        room_id=room_id,
                        actual_checkin=now - timedelta(days=index % 3),
                        actual_checkout=now if status == "checked_out" else None,
                        notes="Generated load-test stay",
                    )
                )
            self._flush_batch(reservation_rows, batch_size)
            self._flush_batch(guest_rows, batch_size)
            self._flush_batch(stay_rows, batch_size)
        self._flush_batch(reservation_rows, 1)
        self._flush_batch(guest_rows, 1)
        self._flush_batch(stay_rows, 1)
        return reservation_ids

    def _insert_tickets(
        self,
        hotel_id: str,
        run_id: str,
        count: int,
        departments: dict[str, Department],
        categories: dict[str, TicketCategory],
        guest_ids: list[str],
        reservation_ids: list[str],
        room_ids: list[str],
        staff_ids: list[str],
        batch_size: int,
    ) -> None:
        rows: list[Ticket] = []
        now = utcnow()
        department_values = [departments[key] for key in DEPARTMENT_KEYS if key in departments]
        category_values = list(categories.values()) or [None]
        for index in range(count):
            department = department_values[index % len(department_values)] if department_values else None
            category = category_values[index % len(category_values)]
            stage = TICKET_STAGES[index % len(TICKET_STAGES)]
            due_offset = -30 if index % 10 == 0 else 30 + (index % 90)
            rows.append(
                Ticket(
                    id=new_uuid(),
                    hotel_id=hotel_id,
                    ticket_code=f"LOAD-TKT-{run_id}-{index + 1:08d}",
                    guest_id=guest_ids[index % len(guest_ids)] if guest_ids else None,
                    reservation_id=reservation_ids[index % len(reservation_ids)] if reservation_ids else None,
                    room_id=room_ids[index % len(room_ids)] if room_ids else None,
                    department_id=department.id if department else None,
                    assigned_to=staff_ids[index % len(staff_ids)] if staff_ids and index % 4 else None,
                    stage=stage,
                    type="Complaint" if index % 20 == 0 else "Ticket",
                    task_category_id=category.id if category else None,
                    task_category=category.key if category else None,
                    item_description=f"Generated load ticket {index + 1:08d}",
                    source=TICKET_SOURCES[index % len(TICKET_SOURCES)],
                    followers=[],
                    priority=1 + (index % 5),
                    sla_due_at=now + timedelta(minutes=due_offset),
                    resolved_at=now if stage == "approved" else None,
                    is_deleted=False,
                    created_at=now - timedelta(minutes=index % 20_160),
                    updated_at=now,
                )
            )
            self._flush_batch(rows, batch_size)
        self._flush_batch(rows, 1)

    def _flush_batch(self, rows: list, batch_size: int) -> None:
        if len(rows) < batch_size:
            return
        self.db.bulk_save_objects(rows)
        self.db.commit()
        rows.clear()


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Seed demo or large local performance data.")
    parser.add_argument("--size", choices=sorted(SIZE_PRESETS), default="small")
    parser.add_argument("--hotel-slug", default=DEMO_SLUG)
    parser.add_argument("--hotels", type=int)
    parser.add_argument("--rooms", type=int)
    parser.add_argument("--staff", type=int)
    parser.add_argument("--guests", type=int)
    parser.add_argument("--reservations", type=int)
    parser.add_argument("--tickets", type=int)
    parser.add_argument("--batch-size", type=int, default=1_000)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args(list(argv) if argv is not None else None)

    init_db()
    plan = resolve_seed_plan(
        args.size,
        hotels=args.hotels,
        rooms=args.rooms,
        staff=args.staff,
        guests=args.guests,
        reservations=args.reservations,
        tickets=args.tickets,
    )
    db = SessionLocal()
    try:
        summary = LoadSeedService(db).seed(
            plan,
            hotel_slug=args.hotel_slug,
            batch_size=max(args.batch_size, 1),
            dry_run=args.dry_run,
        )
        print(json.dumps(_summary_payload(summary), indent=2))
    finally:
        db.close()


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-z0-9-]+", "-", value.lower()).strip("-")
    return slug or "arcadia-load"


def _tenant_slug(base_slug: str, index: int) -> str:
    suffix = f"-{index:03d}"
    max_base_length = 80 - len(suffix)
    base = base_slug[:max_base_length].rstrip("-") or "arcadia-load"
    return f"{base}{suffix}"


def _validate_plan(plan: SeedPlan) -> None:
    if plan.hotels < 1:
        raise ValueError("hotels must be at least 1")
    counts = {
        "rooms": plan.rooms,
        "staff": plan.staff,
        "guests": plan.guests,
        "reservations": plan.reservations,
        "tickets": plan.tickets,
    }
    invalid = [name for name, value in counts.items() if value < 0]
    if invalid:
        raise ValueError(f"Seed counts cannot be negative: {', '.join(invalid)}")


def _summary_payload(summary: SeedSummary) -> dict:
    payload = asdict(summary)
    payload["command"] = "python -m app.seeds.run"
    payload["count_scope"] = "per_hotel"
    return payload


if __name__ == "__main__":
    main()

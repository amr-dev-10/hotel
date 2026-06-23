import pytest

from app.core.database import SessionLocal, init_db
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.reservation import Reservation
from app.models.ticket import Ticket
from app.seeds.run import LoadSeedService, resolve_seed_plan


@pytest.mark.unit
def test_resolve_seed_plan_uses_presets_and_overrides() -> None:
    medium = resolve_seed_plan("medium")
    assert medium.hotels == 1
    assert medium.guests == 1_000
    assert medium.tickets == 5_000

    custom = resolve_seed_plan("small", hotels=3, guests=12, reservations=13, tickets=14)
    assert custom.size == "small"
    assert custom.hotels == 3
    assert custom.rooms == 25
    assert custom.guests == 12
    assert custom.reservations == 13
    assert custom.tickets == 14


@pytest.mark.unit
def test_resolve_seed_plan_has_multi_tenant_preset() -> None:
    plan = resolve_seed_plan("multi")
    assert plan.hotels == 100
    assert plan.guests >= 1_000
    assert plan.reservations >= 1_000
    assert plan.tickets >= 1_000


@pytest.mark.unit
def test_resolve_seed_plan_rejects_unknown_size() -> None:
    with pytest.raises(ValueError):
        resolve_seed_plan("massive")


@pytest.mark.integration
def test_load_seed_dry_run_reports_multiple_tenants_without_large_rows() -> None:
    init_db()
    db = SessionLocal()
    try:
        plan = resolve_seed_plan("small", hotels=2, guests=1, reservations=1, tickets=1)
        summary = LoadSeedService(db).seed(plan, hotel_slug="load-dry-run", batch_size=10, dry_run=True)
        assert summary.hotel_slug == "load-dry-run-001"
        assert [hotel.hotel_slug for hotel in summary.hotels] == ["load-dry-run-001", "load-dry-run-002"]
        assert summary.plan.guests == 1
        assert summary.inserted == {
            "hotels": 0,
            "rooms": 0,
            "staff": 0,
            "guests": 0,
            "reservations": 0,
            "tickets": 0,
        }
    finally:
        db.close()


@pytest.mark.integration
def test_load_seed_can_create_multiple_tenants_with_related_rows() -> None:
    init_db()
    db = SessionLocal()
    try:
        plan = resolve_seed_plan("small", hotels=2, rooms=2, staff=2, guests=2, reservations=2, tickets=2)
        summary = LoadSeedService(db).seed(plan, hotel_slug="load-tenants-test", batch_size=10)

        hotel_ids = [hotel.hotel_id for hotel in summary.hotels]
        assert [hotel.hotel_slug for hotel in summary.hotels] == ["load-tenants-test-001", "load-tenants-test-002"]
        assert summary.inserted["hotels"] == 2
        assert summary.inserted["guests"] == 4
        assert summary.inserted["reservations"] == 4
        assert summary.inserted["tickets"] == 4
        assert db.query(Hotel).filter(Hotel.id.in_(hotel_ids)).count() == 2

        for hotel_id in hotel_ids:
            assert db.query(Guest).filter_by(hotel_id=hotel_id).count() >= 2
            assert db.query(Reservation).filter_by(hotel_id=hotel_id).count() >= 2
            assert db.query(Ticket).filter_by(hotel_id=hotel_id).count() >= 2
    finally:
        db.close()

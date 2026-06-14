from datetime import date

from app.core.database import SessionLocal
from app.repositories.hotel_repository import HotelRepository
from app.services.analytics_service import AnalyticsService


def generate_daily_snapshots(snapshot_date: date | None = None) -> int:
    snapshot_date = snapshot_date or date.today()
    db = SessionLocal()
    generated = 0
    try:
        analytics = AnalyticsService(db)
        for hotel in HotelRepository(db).list_active(limit=500):
            analytics.generate_daily_snapshot(hotel.id, snapshot_date)
            generated += 1
        return generated
    finally:
        db.close()

from datetime import date, timedelta

from app.core.database import SessionLocal
from app.models.base import utcnow
from app.repositories.hotel_repository import HotelRepository
from app.services.attendance_service import AttendanceService
from app.workers.celery_app import celery_app


@celery_app.task(name="attendance.finalize_missing")
def finalize_missing_attendance(target_date: str | None = None, hotel_id: str | None = None) -> dict:
    attendance_date = date.fromisoformat(target_date) if target_date else utcnow().date() - timedelta(days=1)
    db = SessionLocal()
    try:
        hotels = [HotelRepository(db).get(hotel_id)] if hotel_id else HotelRepository(db).list_active(limit=5000)
        results = []
        for hotel in hotels:
            if not hotel or hotel.status != "active":
                continue
            result = AttendanceService(db).finalize_missing_for_date(hotel.id, attendance_date, actor_id=None)
            results.append({"hotel_id": hotel.id, **result})
        return {"ok": True, "attendance_date": attendance_date.isoformat(), "hotels": results}
    finally:
        db.close()

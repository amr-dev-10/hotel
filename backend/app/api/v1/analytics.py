from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.services.analytics_service import AnalyticsService

router = APIRouter()


@router.get("")
def list_analytics(
    hotel_id: str,
    from_date: date = Query(default_factory=date.today, alias="from"),
    to_date: date = Query(default_factory=date.today, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.view")),
) -> dict:
    snapshots = AnalyticsService(db).list_or_generate(hotel_id, from_date, to_date)
    return ok([_snapshot(item) for item in snapshots])


@router.get("/export")
def export_analytics(
    hotel_id: str,
    from_date: date = Query(default_factory=date.today, alias="from"),
    to_date: date = Query(default_factory=date.today, alias="to"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("analytics.export")),
) -> dict:
    snapshots = AnalyticsService(db).list_or_generate(hotel_id, from_date, to_date)
    return ok({"format": "json", "rows": [_snapshot(item) for item in snapshots]})


def _snapshot(item) -> dict:
    return {
        "id": item.id,
        "hotel_id": item.hotel_id,
        "snapshot_date": item.snapshot_date.isoformat(),
        "occupancy_rate": float(item.occupancy_rate),
        "total_rooms": item.total_rooms,
        "occupied_rooms": item.occupied_rooms,
        "total_reservations": item.total_reservations,
        "new_checkins": item.new_checkins,
        "checkouts": item.checkouts,
        "ticket_count": item.ticket_count,
        "avg_resolution_minutes": float(item.avg_resolution_minutes),
        "guest_satisfaction_avg": float(item.guest_satisfaction_avg),
        "revenue_room": float(item.revenue_room),
        "revenue_food": float(item.revenue_food),
        "revenue_other": float(item.revenue_other),
        "revenue_total": float(item.revenue_total),
        "whatsapp_messages": item.whatsapp_messages,
    }

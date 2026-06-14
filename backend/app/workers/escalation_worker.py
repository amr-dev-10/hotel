from app.core.database import SessionLocal
from app.services.escalation_service import EscalationService
from app.workers.celery_app import celery_app


@celery_app.task(name="tickets.check_escalations")
def check_escalations(hotel_id: str | None = None) -> dict:
    db = SessionLocal()
    try:
        fired = EscalationService(db).check_escalations(hotel_id)
        return {"ok": True, "fired": len(fired), "log_ids": [row.id for row in fired]}
    finally:
        db.close()

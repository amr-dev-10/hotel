from app.core.database import SessionLocal
from app.services.ticket_service import TicketService
from app.workers.celery_app import celery_app


@celery_app.task(name="tickets.check_pending_acceptances")
def check_pending_acceptances() -> dict:
    db = SessionLocal()
    try:
        expired = TicketService(db).expire_pending_acceptances()
        return {"ok": True, "expired": len(expired), "ticket_ids": [ticket.id for ticket in expired]}
    finally:
        db.close()

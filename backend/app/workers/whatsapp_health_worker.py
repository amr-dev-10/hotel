from app.core.database import SessionLocal
from app.repositories.whatsapp_repository import WhatsAppAccountRepository
from app.services.whatsapp_ops_service import WhatsAppHealthService


def check_whatsapp_health() -> int:
    db = SessionLocal()
    checked = 0
    try:
        service = WhatsAppHealthService(db)
        for account in WhatsAppAccountRepository(db).list_active():
            service.check_account(account.hotel_id, account.id)
            checked += 1
        return checked
    finally:
        db.close()

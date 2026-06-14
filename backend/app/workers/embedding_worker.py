from app.core.database import SessionLocal
from app.services.knowledge_service import KnowledgeDocumentService


def process_pending_embeddings(hotel_id: str | None = None) -> int:
    db = SessionLocal()
    try:
        processed = KnowledgeDocumentService(db).process_pending_embeddings(hotel_id)
        return len(processed)
    finally:
        db.close()

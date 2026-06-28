from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.knowledge import HotelFAQ, KnowledgeDocument, KnowledgeEmbedding


class AIKnowledgeLoader:
    @staticmethod
    def load_relevant_knowledge(
        db: Session,
        hotel_id: str,
        query: str,
        limit: int = 5,
    ) -> list[dict]:
        words = AIKnowledgeLoader._words(query)
        if not words:
            return []
        candidates: list[tuple[int, dict]] = []
        candidates.extend(AIKnowledgeLoader._faq_candidates(db, hotel_id, words))
        candidates.extend(AIKnowledgeLoader._document_candidates(db, hotel_id, words))
        candidates.sort(key=lambda item: item[0], reverse=True)
        return [item for score, item in candidates if score > 0][:limit]

    @staticmethod
    def _faq_candidates(db: Session, hotel_id: str, words: set[str]) -> list[tuple[int, dict]]:
        rows = db.execute(
            select(HotelFAQ).where(
                HotelFAQ.hotel_id == hotel_id,
                HotelFAQ.is_active.is_(True),
            )
        ).scalars().all()
        candidates = []
        for faq in rows:
            score = len(words & AIKnowledgeLoader._words(f"{faq.question} {faq.category or ''}"))
            candidates.append(
                (
                    score,
                    {
                        "source": "faq",
                        "title": faq.question,
                        "content": faq.answer,
                        "category": faq.category,
                        "language": faq.language,
                    },
                )
            )
        return candidates

    @staticmethod
    def _document_candidates(db: Session, hotel_id: str, words: set[str]) -> list[tuple[int, dict]]:
        active_document_ids = {
            document.id
            for document in db.execute(
                select(KnowledgeDocument).where(
                    KnowledgeDocument.hotel_id == hotel_id,
                    KnowledgeDocument.is_active.is_(True),
                    KnowledgeDocument.status == "ready",
                )
            ).scalars().all()
        }
        if not active_document_ids:
            return []
        rows = db.execute(
            select(KnowledgeEmbedding).where(KnowledgeEmbedding.hotel_id == hotel_id)
        ).scalars().all()
        candidates = []
        for embedding in rows:
            if embedding.document_id not in active_document_ids:
                continue
            score = len(words & AIKnowledgeLoader._words(embedding.chunk_text))
            candidates.append(
                (
                    score,
                    {
                        "source": "knowledge_document",
                        "title": f"Knowledge chunk {embedding.chunk_index + 1}",
                        "content": embedding.chunk_text,
                        "document_id": embedding.document_id,
                    },
                )
            )
        return candidates

    @staticmethod
    def _words(text: str) -> set[str]:
        return {
            word.strip(".,!?;:()[]{}").lower()
            for word in text.split()
            if len(word.strip(".,!?;:()[]{}")) > 2
        }

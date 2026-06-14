from typing import Any

from sqlalchemy.orm import Session

from app.models.base import utcnow
from app.models.ops import AuditLog


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        hotel_id: str,
        action: str,
        entity: str,
        entity_id: str | None = None,
        user_id: str | None = None,
        payload: dict[str, Any] | None = None,
        old_payload: dict[str, Any] | None = None,
        new_payload: dict[str, Any] | None = None,
        ip_address: str | None = None,
        commit: bool = False,
    ) -> AuditLog:
        audit = AuditLog(
            hotel_id=hotel_id,
            user_id=user_id,
            action=action,
            entity=entity,
            entity_id=entity_id,
            payload=payload or {},
            old_payload=old_payload or {},
            new_payload=new_payload or payload or {},
            ip_address=ip_address,
            created_at=utcnow(),
        )
        self.db.add(audit)
        if commit:
            self.db.commit()
            self.db.refresh(audit)
        return audit

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.audit.models import AuditLog
from app.modules.audit.schemas import AuditLogRead

router = APIRouter(prefix="/audit-logs", tags=["audit logs"])


@router.get("", response_model=list[AuditLogRead])
def list_audit_logs(
    context: TenantContext = Depends(require_permission("audit.view")),
    db: Session = Depends(get_db),
) -> list[AuditLog]:
    return list(
        db.scalars(
            select(AuditLog)
            .where(AuditLog.tenant_id == str(context.tenant_id))
            .order_by(AuditLog.created_at.desc())
            .limit(100)
        ).all()
    )

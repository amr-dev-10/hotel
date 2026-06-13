from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.activity.models import Activity
from app.modules.activity.schemas import ActivityRead

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=list[ActivityRead])
def list_activities(
    context: TenantContext = Depends(require_permission("activity.view")),
    db: Session = Depends(get_db),
) -> list[Activity]:
    return list(
        db.scalars(
            select(Activity)
            .where(Activity.tenant_id == str(context.tenant_id))
            .order_by(Activity.created_at.desc())
            .limit(100)
        ).all()
    )

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.notification.models import Notification, NotificationQueue
from app.modules.notification.schemas import NotificationCreate, NotificationRead

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationRead])
def list_notifications(
    context: TenantContext = Depends(require_permission("notification.view")),
    db: Session = Depends(get_db),
) -> list[Notification]:
    return list(db.scalars(select(Notification).where(Notification.tenant_id == str(context.tenant_id))).all())


@router.post("", response_model=NotificationRead, status_code=201)
def queue_notification(
    payload: NotificationCreate,
    context: TenantContext = Depends(require_permission("notification.create")),
    db: Session = Depends(get_db),
) -> Notification:
    notification = Notification(tenant_id=str(context.tenant_id), **payload.model_dump())
    db.add(notification)
    db.flush()
    db.add(NotificationQueue(tenant_id=str(context.tenant_id), notification_id=notification.id))
    db.commit()
    db.refresh(notification)
    return notification

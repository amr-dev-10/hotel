from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext
from app.middleware.permissions import require_permission
from app.modules.activity.models import Activity
from app.modules.dashboard.schemas import DashboardMetrics
from app.modules.ticket.models import Ticket, TicketStatus
from app.modules.user.models import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/metrics", response_model=DashboardMetrics)
def metrics(
    context: TenantContext = Depends(require_permission("dashboard.view")),
    db: Session = Depends(get_db),
) -> DashboardMetrics:
    tenant_id = str(context.tenant_id)
    total_users = db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant_id)) or 0
    active_users = (
        db.scalar(select(func.count()).select_from(User).where(User.tenant_id == tenant_id, User.is_active.is_(True)))
        or 0
    )
    open_tickets = (
        db.scalar(select(func.count()).select_from(Ticket).where(Ticket.tenant_id == tenant_id, Ticket.status != TicketStatus.closed))
        or 0
    )
    closed_tickets = (
        db.scalar(select(func.count()).select_from(Ticket).where(Ticket.tenant_id == tenant_id, Ticket.status == TicketStatus.closed))
        or 0
    )
    recent_activities = db.scalar(select(func.count()).select_from(Activity).where(Activity.tenant_id == tenant_id)) or 0
    return DashboardMetrics(
        total_users=total_users,
        active_users=active_users,
        open_tickets=open_tickets,
        closed_tickets=closed_tickets,
        recent_activities=recent_activities,
    )

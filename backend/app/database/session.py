from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.database.base import Base
from app.modules.activity.models import Activity
from app.modules.audit.models import AuditLog
from app.modules.bot_config.models import BotConfig
from app.modules.department.models import Department
from app.modules.fcm.models import FcmToken
from app.modules.feedback.models import Feedback
from app.modules.guest.models import Guest
from app.modules.menu.models import MenuCategory, MenuItem
from app.modules.auth.models import RefreshToken, UserSession
from app.modules.notification.models import Notification, NotificationQueue, NotificationTemplate
from app.modules.permission.models import Permission, RolePermission
from app.modules.role.models import Role, UserRole
from app.modules.room.models import Room
from app.modules.subscription.models import Plan, Subscription, TenantUsage
from app.modules.tenant.models import PlatformUser, Tenant
from app.modules.ticket.models import Ticket, TicketAssignment, TicketAttachment, TicketHistory, TicketMessage
from app.modules.user.models import User
from app.modules.workflow.models import Workflow, WorkflowStage, WorkflowTransition

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)

_model_imports = (
    Activity,
    AuditLog,
    BotConfig,
    Department,
    FcmToken,
    Feedback,
    Guest,
    MenuCategory,
    MenuItem,
    RefreshToken,
    UserSession,
    Notification,
    NotificationQueue,
    NotificationTemplate,
    Permission,
    RolePermission,
    Role,
    UserRole,
    Room,
    Plan,
    Subscription,
    TenantUsage,
    PlatformUser,
    Tenant,
    Ticket,
    TicketAssignment,
    TicketAttachment,
    TicketHistory,
    TicketMessage,
    User,
    Workflow,
    WorkflowStage,
    WorkflowTransition,
)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi import APIRouter

from app.modules.activity.routes import router as activity_router
from app.modules.auth.routes import router as auth_router
from app.modules.audit.routes import router as audit_router
from app.modules.bot_config.routes import router as bot_config_router
from app.modules.campaign.routes import router as campaign_router
from app.modules.dashboard.routes import router as dashboard_router
from app.modules.department.routes import router as department_router
from app.modules.feedback.routes import router as feedback_router
from app.modules.guest.routes import router as guest_router
from app.modules.hotel.routes import router as hotel_router
from app.modules.menu.routes import router as menu_router
from app.modules.notification.routes import router as notification_router
from app.modules.permission.routes import router as permission_router
from app.modules.role.routes import router as role_router
from app.modules.room.routes import router as room_router
from app.modules.subscription.routes import router as subscription_router
from app.modules.tenant.routes import router as tenant_router
from app.modules.ticket.routes import hotel_router as hotel_ticket_router
from app.modules.ticket.routes import router as ticket_router
from app.modules.user.routes import router as user_router
from app.modules.user.hotel_routes import router as hotel_user_router
from app.modules.workflow.routes import router as workflow_router

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth_router)
api_router.include_router(hotel_router)
api_router.include_router(hotel_user_router)
api_router.include_router(room_router)
api_router.include_router(department_router)
api_router.include_router(hotel_ticket_router)
api_router.include_router(menu_router)
api_router.include_router(guest_router)
api_router.include_router(feedback_router)
api_router.include_router(bot_config_router)
api_router.include_router(campaign_router)
api_router.include_router(tenant_router)
api_router.include_router(user_router)
api_router.include_router(role_router)
api_router.include_router(permission_router)
api_router.include_router(subscription_router)
api_router.include_router(workflow_router)
api_router.include_router(ticket_router)
api_router.include_router(activity_router)
api_router.include_router(audit_router)
api_router.include_router(notification_router)
api_router.include_router(dashboard_router)

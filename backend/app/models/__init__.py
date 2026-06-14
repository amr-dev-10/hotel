from app.models.bot_config import BotConfig
from app.models.campaign import Campaign, CampaignDelivery
from app.models.department import Department
from app.models.feedback import Feedback
from app.models.guest import Guest
from app.models.hotel import Hotel
from app.models.knowledge import (
    BotVersion,
    DepartmentConfig,
    HotelFAQ,
    HotelLanguage,
    ServiceForm,
    ServiceFormField,
)
from app.models.menu import MenuCategory, MenuItem
from app.models.ops import AuditLog, Invoice, MediaFile, Notification, Subscription
from app.models.rbac import Permission, Role, role_permissions, user_roles
from app.models.reservation import Reservation, StayRecord
from app.models.room import Room
from app.models.ticket import ChatMessage, Ticket, TicketEvent, ticket_menu_items
from app.models.user import FCMToken, User
from app.models.whatsapp import (
    WhatsAppAccount,
    WhatsAppConversation,
    WhatsAppMessage,
    WhatsAppTemplate,
)
from app.models.whatsapp_session import WhatsAppSession

__all__ = [
    "AuditLog",
    "BotConfig",
    "BotVersion",
    "Campaign",
    "CampaignDelivery",
    "ChatMessage",
    "Department",
    "DepartmentConfig",
    "FCMToken",
    "Feedback",
    "Guest",
    "Hotel",
    "HotelFAQ",
    "HotelLanguage",
    "Invoice",
    "MediaFile",
    "MenuCategory",
    "MenuItem",
    "Notification",
    "Permission",
    "Reservation",
    "Role",
    "Room",
    "ServiceForm",
    "ServiceFormField",
    "StayRecord",
    "Subscription",
    "Ticket",
    "TicketEvent",
    "User",
    "WhatsAppAccount",
    "WhatsAppConversation",
    "WhatsAppMessage",
    "WhatsAppSession",
    "WhatsAppTemplate",
    "role_permissions",
    "ticket_menu_items",
    "user_roles",
]

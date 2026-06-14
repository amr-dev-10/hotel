from fastapi import APIRouter

from app.api.v1 import (
    auth,
    bot_config,
    campaigns,
    departments,
    feedback,
    guests,
    hotels,
    knowledge,
    menu,
    ops,
    reservations,
    roles,
    rooms,
    tickets,
    users,
    whatsapp_accounts,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(hotels.router, prefix="/hotels", tags=["hotels"])
api_router.include_router(users.router, prefix="/hotels/{hotel_id}/users", tags=["users"])
api_router.include_router(roles.router, prefix="/hotels/{hotel_id}/roles", tags=["roles"])
api_router.include_router(rooms.router, prefix="/hotels/{hotel_id}/rooms", tags=["rooms"])
api_router.include_router(
    departments.router,
    prefix="/hotels/{hotel_id}/departments",
    tags=["departments"],
)
api_router.include_router(guests.router, prefix="/hotels/{hotel_id}/guests", tags=["guests"])
api_router.include_router(
    reservations.router,
    prefix="/hotels/{hotel_id}/reservations",
    tags=["reservations"],
)
api_router.include_router(tickets.router, prefix="/hotels/{hotel_id}/tickets", tags=["tickets"])
api_router.include_router(menu.router, prefix="/hotels/{hotel_id}/menu", tags=["menu"])
api_router.include_router(
    bot_config.router,
    prefix="/hotels/{hotel_id}/bot-config",
    tags=["bot-config"],
)
api_router.include_router(
    campaigns.router,
    prefix="/hotels/{hotel_id}/campaigns",
    tags=["campaigns"],
)
api_router.include_router(
    whatsapp_accounts.router,
    prefix="/hotels/{hotel_id}/whatsapp",
    tags=["whatsapp"],
)
api_router.include_router(
    knowledge.router,
    prefix="/hotels/{hotel_id}/knowledge",
    tags=["knowledge"],
)
api_router.include_router(
    ops.router,
    prefix="/hotels/{hotel_id}",
    tags=["operations"],
)
api_router.include_router(
    feedback.router,
    prefix="/hotels/{hotel_id}/feedback",
    tags=["feedback"],
)

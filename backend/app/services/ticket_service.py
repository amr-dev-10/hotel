from typing import Any

from app.services.realtime import realtime_manager


async def publish_ticket_event(hotel_id: str, event_type: str, payload: dict[str, Any]) -> None:
    await realtime_manager.broadcast(
        f"hotel:{hotel_id}:tickets",
        {
            "type": event_type,
            "hotel_id": hotel_id,
            "payload": payload,
        },
    )


async def publish_chat_event(hotel_id: str, ticket_id: str, payload: dict[str, Any]) -> None:
    await realtime_manager.broadcast(
        f"hotel:{hotel_id}:ticket:{ticket_id}:chat",
        {
            "type": "chat.message",
            "hotel_id": hotel_id,
            "ticket_id": ticket_id,
            "payload": payload,
        },
    )

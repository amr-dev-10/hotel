from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.realtime import realtime_manager

websocket_router = APIRouter(tags=["websockets"])


@websocket_router.websocket("/ws/hotels/{hotel_id}/tickets")
async def hotel_ticket_updates(websocket: WebSocket, hotel_id: str) -> None:
    channel = f"hotel:{hotel_id}:tickets"
    await realtime_manager.connect(channel, websocket)
    await websocket.send_json({"type": "connection.ready", "channel": channel})
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        realtime_manager.disconnect(channel, websocket)


@websocket_router.websocket("/ws/hotels/{hotel_id}/chat/{ticket_id}")
async def hotel_ticket_chat(websocket: WebSocket, hotel_id: str, ticket_id: str) -> None:
    channel = f"hotel:{hotel_id}:ticket:{ticket_id}:chat"
    await realtime_manager.connect(channel, websocket)
    await websocket.send_json({"type": "connection.ready", "channel": channel})
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        realtime_manager.disconnect(channel, websocket)


@websocket_router.websocket("/ws/voice")
async def voice_stream(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "voice.connection.ready"})
    try:
        while True:
            await websocket.receive()
    except WebSocketDisconnect:
        return

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[str, list[WebSocket]] = {}

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.setdefault(channel, []).append(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        connections = self.active.get(channel, [])
        if websocket in connections:
            connections.remove(websocket)

    async def broadcast(self, channel: str, payload: dict) -> None:
        for websocket in self.active.get(channel, []):
            await websocket.send_json(payload)


manager = ConnectionManager()


@router.websocket("/ws/{hotel_id}/tickets")
async def ticket_updates(websocket: WebSocket, hotel_id: str) -> None:
    channel = f"hotel:{hotel_id}:tickets"
    await manager.connect(channel, websocket)
    try:
        await websocket.send_json({"event": "connected", "channel": channel})
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(channel, data)
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)


@router.websocket("/ws/{hotel_id}/chat/{ticket_id}")
async def chat_updates(websocket: WebSocket, hotel_id: str, ticket_id: str) -> None:
    channel = f"hotel:{hotel_id}:chat:{ticket_id}"
    await manager.connect(channel, websocket)
    try:
        await websocket.send_json({"event": "connected", "channel": channel})
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(channel, data)
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)

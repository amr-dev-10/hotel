from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import decode_access_token
from app.repositories.user_repository import UserRepository
from app.services.rbac_service import RBACService

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


async def _authenticate_websocket(
    websocket: WebSocket,
    db: Session,
    permission_code: str | None = None,
) -> tuple[str, str] | None:
    token = websocket.query_params.get("token")
    if not token:
        try:
            data = await websocket.receive_json()
        except Exception:
            data = {}
        token = data.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return None
    try:
        payload = decode_access_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return None
    user_id = payload.get("sub")
    hotel_id = payload.get("hotel_id")
    user = UserRepository(db).get(user_id) if user_id else None
    if not user or not hotel_id or user.hotel_id != hotel_id:
        await websocket.close(code=4001, reason="Invalid token scope")
        return None
    if permission_code:
        try:
            RBACService(db).require(user, permission_code)
        except Exception:
            await websocket.close(code=4003, reason="Forbidden")
            return None
    return hotel_id, user.id


@router.websocket("/ws/tickets")
async def ticket_updates_v3(websocket: WebSocket) -> None:
    await websocket.accept()
    db = SessionLocal()
    auth = await _authenticate_websocket(websocket, db, "ticket.view")
    if not auth:
        db.close()
        return
    hotel_id, _ = auth
    channel = f"hotel:{hotel_id}:tickets"
    manager.active.setdefault(channel, []).append(websocket)
    try:
        await websocket.send_json({"event": "connected", "topic": "tickets"})
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(channel, data)
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)
    finally:
        db.close()


@router.websocket("/ws/orders")
async def order_updates_v3(websocket: WebSocket) -> None:
    await websocket.accept()
    db = SessionLocal()
    auth = await _authenticate_websocket(websocket, db, "restaurant.manage")
    if not auth:
        db.close()
        return
    hotel_id, _ = auth
    channel = f"hotel:{hotel_id}:orders"
    manager.active.setdefault(channel, []).append(websocket)
    try:
        await websocket.send_json({"event": "connected", "topic": "orders"})
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(channel, data)
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)
    finally:
        db.close()


@router.websocket("/ws/chat")
async def chat_updates_v3(websocket: WebSocket) -> None:
    await websocket.accept()
    db = SessionLocal()
    auth = await _authenticate_websocket(websocket, db, "ticket.view")
    if not auth:
        db.close()
        return
    hotel_id, _ = auth
    topic = websocket.query_params.get("topic") or "live"
    channel = f"hotel:{hotel_id}:chat:{topic}"
    manager.active.setdefault(channel, []).append(websocket)
    try:
        await websocket.send_json({"event": "connected", "topic": "chat", "channel": topic})
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(channel, data)
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)
    finally:
        db.close()


@router.websocket("/ws/notifications")
async def notifications_v3(websocket: WebSocket) -> None:
    await websocket.accept()
    db = SessionLocal()
    auth = await _authenticate_websocket(websocket, db)
    if not auth:
        db.close()
        return
    hotel_id, user_id = auth
    channel = f"hotel:{hotel_id}:user:{user_id}:notifications"
    manager.active.setdefault(channel, []).append(websocket)
    try:
        await websocket.send_json({"event": "connected", "topic": "notifications"})
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(channel, data)
    except WebSocketDisconnect:
        manager.disconnect(channel, websocket)
    finally:
        db.close()


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

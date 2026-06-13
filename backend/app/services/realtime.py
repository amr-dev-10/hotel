from collections import defaultdict
from typing import Any

from fastapi import WebSocket


class RealtimeConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)

    async def connect(self, channel: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[channel].add(websocket)

    def disconnect(self, channel: str, websocket: WebSocket) -> None:
        self._connections[channel].discard(websocket)
        if not self._connections[channel]:
            self._connections.pop(channel, None)

    async def broadcast(self, channel: str, payload: dict[str, Any]) -> None:
        stale: list[WebSocket] = []
        for websocket in self._connections.get(channel, set()):
            try:
                await websocket.send_json(payload)
            except RuntimeError:
                stale.append(websocket)
        for websocket in stale:
            self.disconnect(channel, websocket)


realtime_manager = RealtimeConnectionManager()

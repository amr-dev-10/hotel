import json
import asyncio
from typing import Any

from app.core.config import settings


class NotificationService:
    def publish(self, channel: str, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            import redis

            client = redis.Redis.from_url(settings.redis_url)
            client.publish(channel, json.dumps(payload, default=str))
            return {"published": True, "channel": channel}
        except Exception as exc:
            return {
                "published": False,
                "channel": channel,
                "reason": str(exc),
            }

    def publish_ticket_event(self, hotel_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self.publish(f"hotel:{hotel_id}:tickets", payload)

    def publish_user_notification(
        self,
        hotel_id: str,
        user_id: str | None,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if not user_id:
            return {"published": False, "dry_run": True}
        channel = f"hotel:{hotel_id}:user:{user_id}:notifications"
        result = self.publish(channel, payload)
        result["websocket_dispatched"] = self._broadcast_in_process(channel, payload)
        return result

    def _broadcast_in_process(self, channel: str, payload: dict[str, Any]) -> bool:
        try:
            from app.api.ws.routes import manager

            try:
                import anyio

                anyio.from_thread.run(manager.broadcast, channel, payload)
                return True
            except Exception:
                loop = asyncio.get_running_loop()
                loop.create_task(manager.broadcast(channel, payload))
                return True
        except Exception:
            return False

    def send_fcm_to_user(
        self,
        user_id: str | None,
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not user_id or not settings.fcm_enabled:
            return {"sent": False, "dry_run": True}
        return {
            "sent": False,
            "dry_run": True,
            "user_id": user_id,
            "title": title,
            "body": body,
            "data": data or {},
        }

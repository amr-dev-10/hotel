import json
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

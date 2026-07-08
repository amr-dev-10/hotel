import json
import asyncio
from typing import Any

from app.core.config import settings
from app.core.database import SessionLocal
from app.repositories.user_repository import FCMTokenRepository


class FCMClient:
    _initialized = False

    @classmethod
    def send_to_tokens(
        cls,
        tokens: list[str],
        title: str,
        body: str,
        data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not tokens:
            return {"sent": False, "reason": "no_tokens"}

        try:
            cls._ensure_initialized()
            from firebase_admin import messaging

            message_data = {
                key: str(value)
                for key, value in (data or {}).items()
                if value is not None
            }
            sent = 0
            failures: list[str] = []
            for token in tokens:
                try:
                    messaging.send(
                        messaging.Message(
                            token=token,
                            notification=messaging.Notification(
                                title=title,
                                body=body,
                            ),
                            data=message_data,
                            android=messaging.AndroidConfig(
                                priority="high",
                                notification=messaging.AndroidNotification(
                                    channel_id="escalations",
                                    priority="high",
                                    sound="default",
                                ),
                            ),
                            apns=messaging.APNSConfig(
                                payload=messaging.APNSPayload(
                                    aps=messaging.Aps(sound="default"),
                                ),
                            ),
                        )
                    )
                    sent += 1
                except Exception as exc:
                    failures.append(str(exc))

            return {
                "sent": sent > 0,
                "sent_count": sent,
                "failure_count": len(failures),
                "failures": failures[:5],
            }
        except Exception as exc:
            return {"sent": False, "reason": str(exc)}

    @classmethod
    def _ensure_initialized(cls) -> None:
        if cls._initialized:
            return

        import firebase_admin

        try:
            firebase_admin.get_app()
        except ValueError:
            credential = None
            if settings.fcm_credentials_file:
                from firebase_admin import credentials

                credential = credentials.Certificate(settings.fcm_credentials_file)
            options = (
                {"projectId": settings.fcm_project_id}
                if settings.fcm_project_id
                else None
            )
            firebase_admin.initialize_app(credential, options)
        cls._initialized = True


class NotificationService:
    def __init__(self, db=None) -> None:
        self.db = db

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

    def publish_order_event(self, hotel_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        channel = f"hotel:{hotel_id}:orders"
        result = self.publish(channel, payload)
        result["websocket_dispatched"] = self._broadcast_in_process(channel, payload)
        return result

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

        if self.db is not None:
            tokens = [
                token.token
                for token in FCMTokenRepository(self.db).list_for_user(user_id)
            ]
            return FCMClient.send_to_tokens(tokens, title, body, data)

        with SessionLocal() as db:
            tokens = [
                token.token
                for token in FCMTokenRepository(db).list_for_user(user_id)
            ]
            return FCMClient.send_to_tokens(tokens, title, body, data)

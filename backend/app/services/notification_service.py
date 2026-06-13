from typing import Any

from app.core.config import settings


class FcmNotificationService:
    def __init__(self, credentials_path: str | None = None) -> None:
        self.credentials_path = credentials_path or settings.firebase_credentials_path

    def _ensure_app(self) -> None:
        import firebase_admin
        from firebase_admin import credentials

        if firebase_admin._apps:
            return
        if not self.credentials_path:
            raise RuntimeError("FIREBASE_CREDENTIALS_PATH is not configured")
        firebase_admin.initialize_app(credentials.Certificate(self.credentials_path))

    def send_to_token(self, token: str, title: str, body: str, data: dict[str, str] | None = None) -> str:
        self._ensure_app()
        from firebase_admin import messaging

        message = messaging.Message(
            token=token,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
        )
        return messaging.send(message)

    def send_multicast(self, tokens: list[str], title: str, body: str, data: dict[str, str] | None = None) -> Any:
        self._ensure_app()
        from firebase_admin import messaging

        message = messaging.MulticastMessage(
            tokens=tokens,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
        )
        return messaging.send_each_for_multicast(message)

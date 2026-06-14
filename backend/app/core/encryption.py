from app.core.config import settings


def encrypt_secret(value: str | None) -> str | None:
    if not value:
        return value
    key = getattr(settings, "encryption_key", "")
    if not key:
        return value
    try:
        from cryptography.fernet import Fernet

        return Fernet(key.encode("utf-8")).encrypt(value.encode("utf-8")).decode("utf-8")
    except Exception:
        return value


def decrypt_secret(value: str | None) -> str | None:
    if not value:
        return value
    key = getattr(settings, "encryption_key", "")
    if not key:
        return value
    try:
        from cryptography.fernet import Fernet

        return Fernet(key.encode("utf-8")).decrypt(value.encode("utf-8")).decode("utf-8")
    except Exception:
        return value

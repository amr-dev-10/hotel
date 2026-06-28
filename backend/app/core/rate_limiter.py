from fastapi import HTTPException, Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.rate_limit_service import RateLimitService


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not settings.rate_limit_enabled:
            return await call_next(request)
        if request.url.path in {"/health", "/docs", "/openapi.json"}:
            return await call_next(request)
        group = self._group(request.url.path)
        identifier = self._limit_identifier(request)
        db = SessionLocal()
        try:
            RateLimitService(db).check(identifier, group)
        except HTTPException as exc:
            status_code = exc.status_code
            return JSONResponse(
                status_code=status_code,
                content={"detail": getattr(exc, "detail", "API rate limit exceeded")},
            )
        finally:
            db.close()
        return await call_next(request)

    def _group(self, path: str) -> str:
        if path.endswith("/auth/me"):
            return "general"
        if "/auth/" in path:
            return "auth"
        if "/tickets" in path:
            return "tickets"
        if "/webhook/whatsapp" in path or "/whatsapp" in path:
            return "whatsapp"
        if "/menu" in path:
            return "menu"
        if "/exports" in path:
            return "export"
        if "/imports" in path:
            return "import"
        return "general"

    def _hotel_id_from_path(self, path: str) -> str | None:
        parts = [part for part in path.split("/") if part]
        if "hotels" not in parts:
            return None
        index = parts.index("hotels")
        if index + 1 < len(parts):
            return parts[index + 1]
        return None

    def _limit_identifier(self, request: Request) -> str:
        hotel_id = request.path_params.get("hotel_id") or self._hotel_id_from_path(request.url.path)
        if hotel_id:
            return hotel_id
        return f"ip:{self._client_ip(request)}"

    def _client_ip(self, request: Request) -> str:
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            for value in forwarded_for.split(","):
                ip_address = value.strip()
                if ip_address:
                    return ip_address

        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()

        if request.client and request.client.host:
            return request.client.host

        return "unknown"

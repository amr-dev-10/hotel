import base64
import binascii
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy import select

from app.api.v1.router import api_router
from app.api.v1.webhooks import router as whatsapp_webhook_router
from app.api.ws.routes import router as websocket_router
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.core.error_handlers import register_error_handlers
from app.core.performance import PerformanceMetricsMiddleware
from app.core.rate_limiter import RateLimitMiddleware
from app.models.ops import MediaFile
from app.services.rbac_service import RBACService


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.auto_create_tables:
        init_db()
    db = SessionLocal()
    try:
        RBACService(db).seed_permissions()
        db.commit()
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.0.0-rc.1",
    description="Modular monolith backend for the Arcadia hotel platform.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(PerformanceMetricsMiddleware)
register_error_handlers(app)
MOBILE_MEDIA_DIR = Path(__file__).resolve().parent.parent / "media" / "mobile"


@app.get("/media/mobile/{hotel_id}/{filename}", include_in_schema=False)
def mobile_media(hotel_id: str, filename: str) -> Response:
    file_url = f"/media/mobile/{hotel_id}/{filename}"
    media: MediaFile | None = None
    db = SessionLocal()
    try:
        media = db.execute(
            select(MediaFile).where(
                MediaFile.hotel_id == hotel_id,
                MediaFile.file_url == file_url,
            )
        ).scalars().first()
        if media and media.file_data_base64:
            try:
                content = base64.b64decode(media.file_data_base64.encode("ascii"), validate=True)
            except (binascii.Error, ValueError) as exc:
                raise HTTPException(status_code=500, detail="Stored media is corrupted") from exc
            return Response(
                content=content,
                media_type=media.file_type or "application/octet-stream",
                headers={"Cache-Control": "public, max-age=31536000, immutable"},
            )
    finally:
        db.close()

    legacy_path = (MOBILE_MEDIA_DIR / hotel_id / filename).resolve()
    try:
        legacy_path.relative_to(MOBILE_MEDIA_DIR.resolve())
        is_legacy_media = legacy_path.is_file()
    except ValueError:
        is_legacy_media = False

    if is_legacy_media:
        return Response(
            content=legacy_path.read_bytes(),
            media_type=(media.file_type if media else None) or "application/octet-stream",
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    raise HTTPException(status_code=404, detail="Media not found")


@app.get("/health", tags=["system"])
def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(whatsapp_webhook_router)
app.include_router(websocket_router)

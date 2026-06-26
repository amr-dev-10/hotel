from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.api.v1.webhooks import router as whatsapp_webhook_router
from app.api.ws.routes import router as websocket_router
from app.core.config import settings
from app.core.database import init_db
from app.core.performance import PerformanceMetricsMiddleware
from app.core.rate_limiter import RateLimitMiddleware


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.auto_create_tables:
        init_db()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
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


@app.get("/health", tags=["system"])
def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(whatsapp_webhook_router)
app.include_router(websocket_router)

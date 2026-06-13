from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.websockets import websocket_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.database.session import init_db
from app.modules.webhook.routes import router as webhook_router

configure_logging()


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    yield

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Multi-tenant hotel SaaS REST API foundation.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health() -> dict[str, bool]:
    return {"ok": True}


app.include_router(api_router)
app.include_router(webhook_router)
app.include_router(websocket_router)

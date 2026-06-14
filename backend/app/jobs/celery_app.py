from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "hotel_cloud",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=[
        "app.workers.sla_sweep",
        "app.workers.checkout_sweep",
        "app.workers.campaign_sender",
    ],
)

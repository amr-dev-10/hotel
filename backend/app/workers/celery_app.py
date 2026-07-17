from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "arcadia",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_track_started=True,
    timezone=settings.default_timezone,
    beat_schedule={
        "check-pending-acceptances-every-minute": {
            "task": "tickets.check_pending_acceptances",
            "schedule": crontab(minute="*"), # runs every 1 minute
        },
        "check-escalations-every-minute": {
            "task": "tickets.check_escalations",
            "schedule": crontab(minute="*"), # runs every 1 minute
        },
        "finalize-attendance-nightly": {
            "task": "attendance.finalize_missing",
            "schedule": crontab(hour=1, minute=15),
        },
    }
)

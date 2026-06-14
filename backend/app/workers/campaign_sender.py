from app.workers.celery_app import celery_app


@celery_app.task(name="campaigns.send_scheduled")
def send_scheduled_campaigns() -> dict:
    return {
        "ok": True,
        "message": "Scheduled campaign dispatch hook is ready for DB polling.",
    }

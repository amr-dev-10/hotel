from app.workers.celery_app import celery_app


@celery_app.task(name="campaigns.dispatch_due")
def dispatch_due_campaigns() -> dict:
    return {
        "ok": True,
        "message": "Due campaign dispatch hook is ready for scheduled WhatsApp templates.",
    }

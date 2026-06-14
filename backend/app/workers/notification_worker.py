from app.workers.celery_app import celery_app


@celery_app.task(name="notifications.send_push")
def send_push_notification(user_id: str, title: str, body: str, data: dict | None = None) -> dict:
    return {
        "ok": True,
        "dry_run": True,
        "user_id": user_id,
        "title": title,
        "body": body,
        "data": data or {},
    }

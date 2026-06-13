from app.jobs.celery_app import celery_app


@celery_app.task(name="workers.checkout_sweep")
def checkout_sweep() -> dict[str, int]:
    return {"guests_checked": 0, "rooms_released": 0}

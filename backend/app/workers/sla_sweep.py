from app.jobs.celery_app import celery_app


@celery_app.task(name="workers.sla_sweep")
def sla_sweep() -> dict[str, int]:
    return {"tickets_checked": 0, "alerts_created": 0}

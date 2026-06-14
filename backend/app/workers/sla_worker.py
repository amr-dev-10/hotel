from app.workers.celery_app import celery_app


@celery_app.task(name="tickets.sla_sweep")
def sweep_ticket_sla() -> dict:
    return {
        "ok": True,
        "message": "SLA sweep hook is ready for overdue-ticket escalation.",
    }

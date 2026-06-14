from app.workers.celery_app import celery_app


@celery_app.task(name="guests.checkout_sweep")
def sweep_checked_out_guests() -> dict:
    return {
        "ok": True,
        "message": "Checkout sweep hook is ready for session expiry cleanup.",
    }

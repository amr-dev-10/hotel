from datetime import date


def create_checkout_clean_tasks(target_date: date | None = None) -> int:
    target_date = target_date or date.today()
    # Checkout-clean tasks are created synchronously during checkout in this backend.
    # The worker is kept as the scheduled reconciliation entry point for deployments.
    return 0

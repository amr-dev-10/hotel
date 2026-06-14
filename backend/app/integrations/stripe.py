class StripeClient:
    def create_billing_portal_session(self, customer_id: str, return_url: str) -> dict:
        return {
            "dry_run": True,
            "customer_id": customer_id,
            "return_url": return_url,
        }

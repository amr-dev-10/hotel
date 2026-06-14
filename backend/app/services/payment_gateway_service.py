from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.folio import Payment, PaymentTransaction
from app.repositories.folio_repository import FolioRepository, PaymentRepository, PaymentTransactionRepository
from app.schemas.folio import PaymentGatewayOrderCreate, PaymentWebhookPayload


class PaymentGatewayService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.folios = FolioRepository(db)
        self.payments = PaymentRepository(db)
        self.transactions = PaymentTransactionRepository(db)

    def create_order(
        self,
        hotel_id: str,
        folio_id: str,
        payload: PaymentGatewayOrderCreate,
        actor_id: str | None,
        commit: bool = True,
    ) -> PaymentTransaction:
        folio = self.folios.get_for_hotel(hotel_id, folio_id)
        if not folio:
            raise not_found("Folio not found")
        payment = Payment(
            hotel_id=hotel_id,
            folio_id=folio_id,
            amount=payload.amount,
            currency=payload.currency,
            payment_method=payload.gateway,
            status="completed" if payload.gateway == "manual" else "pending",
            collected_by=actor_id,
        )
        self.db.add(payment)
        self.db.flush()
        transaction = self.record_transaction(
            hotel_id,
            payment.id,
            payload.amount,
            payload.currency,
            payload.gateway,
            "captured" if payload.gateway == "manual" else "created",
            raw_request=payload.raw_request,
            raw_response={"stub": True, "gateway": payload.gateway},
            commit=False,
        )
        if commit:
            self.db.commit()
            self.db.refresh(transaction)
        return transaction

    def record_transaction(
        self,
        hotel_id: str,
        payment_id: str,
        amount: Decimal,
        currency: str,
        gateway: str = "manual",
        gateway_status: str = "captured",
        raw_request: dict | None = None,
        raw_response: dict | None = None,
        commit: bool = False,
    ) -> PaymentTransaction:
        transaction = PaymentTransaction(
            hotel_id=hotel_id,
            payment_id=payment_id,
            gateway=gateway,
            gateway_order_id=f"{gateway}_order_{payment_id[:8]}",
            gateway_txn_id=f"{gateway}_txn_{payment_id[:8]}",
            gateway_status=gateway_status,
            amount=amount,
            currency=currency,
            raw_request=raw_request or {},
            raw_response=raw_response or {},
            webhook_received_at=utcnow() if gateway_status in {"captured", "failed", "refunded"} else None,
        )
        self.db.add(transaction)
        self.db.flush()
        if commit:
            self.db.commit()
            self.db.refresh(transaction)
        return transaction

    def handle_webhook(
        self,
        gateway: str,
        gateway_txn_id: str,
        payload: PaymentWebhookPayload,
    ) -> PaymentTransaction:
        transaction = self.transactions.get_by_gateway_txn(gateway, gateway_txn_id)
        if not transaction:
            raise not_found("Payment transaction not found")
        transaction.gateway_status = payload.gateway_status
        transaction.raw_response = payload.raw_response
        transaction.webhook_received_at = utcnow()
        payment = self.payments.get(transaction.payment_id)
        if payment:
            payment.status = "completed" if payload.gateway_status == "captured" else payload.gateway_status
        self.db.commit()
        self.db.refresh(transaction)
        return transaction

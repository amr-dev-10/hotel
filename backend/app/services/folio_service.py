from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.folio import FolioItem, GuestFolio, Payment, Refund, TaxConfig
from app.repositories.folio_repository import (
    FolioItemRepository,
    FolioRepository,
    PaymentRepository,
    RefundRepository,
    TaxConfigRepository,
)
from app.repositories.reservation_repository import ReservationRepository
from app.schemas.folio import FolioItemCreate, PaymentCreate, RefundCreate, TaxConfigCreate
from app.services.audit_service import AuditService


class FolioService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.folios = FolioRepository(db)
        self.items = FolioItemRepository(db)
        self.payments = PaymentRepository(db)
        self.refunds = RefundRepository(db)
        self.taxes = TaxConfigRepository(db)
        self.reservations = ReservationRepository(db)
        self.audit = AuditService(db)

    def ensure_for_reservation(
        self,
        hotel_id: str,
        reservation_id: str,
        actor_id: str | None = None,
        commit: bool = False,
    ) -> GuestFolio:
        folio = self.folios.get_for_reservation(hotel_id, reservation_id)
        if folio:
            return folio
        reservation = self.reservations.get_for_hotel(hotel_id, reservation_id)
        if not reservation:
            raise not_found("Reservation not found")
        folio = GuestFolio(
            hotel_id=hotel_id,
            reservation_id=reservation.id,
            guest_id=reservation.guest_id,
            folio_number=self._folio_number(),
            status="open",
            currency="INR",
        )
        self.db.add(folio)
        self.db.flush()
        self.audit.log(hotel_id, "folio.created", "folio", folio.id, actor_id)
        if commit:
            self.db.commit()
            self.db.refresh(folio)
        return folio

    def add_item(
        self,
        hotel_id: str,
        folio_id: str,
        payload: FolioItemCreate,
        posted_by: str | None,
        commit: bool = True,
    ) -> FolioItem:
        folio = self.folios.get_for_hotel(hotel_id, folio_id)
        if not folio:
            raise not_found("Folio not found")
        total_amount = payload.total_amount
        if total_amount is None:
            total_amount = (
                Decimal(payload.quantity)
                * Decimal(payload.unit_price)
                + Decimal(payload.tax_amount)
                - Decimal(payload.discount_amount)
            )
        item = FolioItem(
            hotel_id=hotel_id,
            folio_id=folio_id,
            ticket_id=payload.ticket_id,
            item_type=payload.item_type,
            description=payload.description,
            quantity=payload.quantity,
            unit_price=payload.unit_price,
            tax_amount=payload.tax_amount,
            discount_amount=payload.discount_amount,
            total_amount=total_amount,
            date=payload.date or date.today(),
            posted_by=posted_by,
        )
        self.db.add(item)
        self.db.flush()
        self._recalculate(folio)
        self.audit.log(hotel_id, "folio.item.added", "folio", folio.id, posted_by)
        if commit:
            self.db.commit()
            self.db.refresh(item)
        return item

    def add_payment(
        self,
        hotel_id: str,
        folio_id: str,
        payload: PaymentCreate,
        collected_by: str | None,
    ) -> Payment:
        folio = self.folios.get_for_hotel(hotel_id, folio_id)
        if not folio:
            raise not_found("Folio not found")
        payment = Payment(
            hotel_id=hotel_id,
            folio_id=folio_id,
            amount=payload.amount,
            currency=payload.currency,
            payment_method=payload.payment_method,
            reference_no=payload.reference_no,
            status=payload.status,
            collected_by=collected_by,
        )
        self.db.add(payment)
        self.db.flush()
        self._recalculate(folio)
        if folio.balance_due <= 0 and folio.status == "closed":
            folio.status = "settled"
        self.audit.log(hotel_id, "folio.payment.added", "folio", folio.id, collected_by)
        from app.services.payment_gateway_service import PaymentGatewayService

        PaymentGatewayService(self.db).record_transaction(
            hotel_id,
            payment.id,
            payment.amount,
            payment.currency,
            gateway=payment.payment_method or "manual",
            gateway_status="captured" if payment.status == "completed" else payment.status,
            raw_request={"source": "folio_payment"},
            raw_response={"stub": True},
            commit=False,
        )
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def add_refund(
        self,
        hotel_id: str,
        folio_id: str,
        payload: RefundCreate,
        processed_by: str | None,
    ) -> Refund:
        folio = self.folios.get_for_hotel(hotel_id, folio_id)
        payment = self.payments.get(payload.payment_id)
        if not folio or not payment or payment.folio_id != folio_id:
            raise not_found("Payment or folio not found")
        refund = Refund(
            hotel_id=hotel_id,
            payment_id=payload.payment_id,
            folio_id=folio_id,
            amount=payload.amount,
            reason=payload.reason,
            status=payload.status,
            processed_by=processed_by,
        )
        self.db.add(refund)
        self.db.flush()
        self._recalculate(folio)
        self.audit.log(hotel_id, "folio.refund.added", "folio", folio.id, processed_by)
        self.db.commit()
        self.db.refresh(refund)
        return refund

    def close(self, hotel_id: str, reservation_id: str, actor_id: str | None = None) -> GuestFolio:
        folio = self.ensure_for_reservation(hotel_id, reservation_id, actor_id)
        folio.status = "settled" if folio.balance_due <= 0 else "closed"
        folio.closed_at = utcnow()
        self.audit.log(hotel_id, "folio.closed", "folio", folio.id, actor_id)
        self.db.flush()
        return folio

    def create_tax_config(
        self,
        hotel_id: str,
        payload: TaxConfigCreate,
        actor_id: str | None,
    ) -> TaxConfig:
        tax = TaxConfig(hotel_id=hotel_id, **payload.model_dump())
        self.db.add(tax)
        self.audit.log(hotel_id, "tax_config.created", "tax_config", None, actor_id)
        self.db.commit()
        self.db.refresh(tax)
        return tax

    def _recalculate(self, folio: GuestFolio) -> None:
        item_total = sum(
            Decimal(item.total_amount or 0)
            for item in self.items.list_for_folio(folio.hotel_id, folio.id)
        )
        payment_total = sum(
            Decimal(payment.amount or 0)
            for payment in self.db.execute(
                select(Payment).where(
                    Payment.hotel_id == folio.hotel_id,
                    Payment.folio_id == folio.id,
                    Payment.status == "completed",
                )
            ).scalars()
        )
        refund_total = sum(
            Decimal(refund.amount or 0)
            for refund in self.db.execute(
                select(Refund).where(
                    Refund.hotel_id == folio.hotel_id,
                    Refund.folio_id == folio.id,
                    Refund.status == "processed",
                )
            ).scalars()
        )
        folio.total_charges = item_total
        folio.total_payments = payment_total - refund_total
        folio.balance_due = folio.total_charges - folio.total_payments

    def _folio_number(self) -> str:
        return f"FOL-{utcnow().strftime('%Y%m%d%H%M%S')}-{uuid4().hex[:4].upper()}"

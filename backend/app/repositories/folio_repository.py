from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.folio import FolioItem, GuestFolio, Payment, PaymentTransaction, Refund, TaxConfig
from app.repositories.base import BaseRepository


class FolioRepository(BaseRepository[GuestFolio]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, GuestFolio)

    def get_for_reservation(self, hotel_id: str, reservation_id: str) -> GuestFolio | None:
        return self.db.execute(
            select(GuestFolio).where(
                GuestFolio.hotel_id == hotel_id,
                GuestFolio.reservation_id == reservation_id,
            )
        ).scalar_one_or_none()

    def get_open_for_guest(self, hotel_id: str, guest_id: str) -> GuestFolio | None:
        return self.db.execute(
            select(GuestFolio)
            .where(
                GuestFolio.hotel_id == hotel_id,
                GuestFolio.guest_id == guest_id,
                GuestFolio.status.in_(("open", "closed")),
            )
            .order_by(GuestFolio.created_at.desc())
        ).scalars().first()


class FolioItemRepository(BaseRepository[FolioItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, FolioItem)

    def list_for_folio(self, hotel_id: str, folio_id: str) -> Sequence[FolioItem]:
        return self.db.execute(
            select(FolioItem)
            .where(FolioItem.hotel_id == hotel_id, FolioItem.folio_id == folio_id)
            .order_by(FolioItem.created_at)
        ).scalars().all()


class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Payment)


class PaymentTransactionRepository(BaseRepository[PaymentTransaction]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, PaymentTransaction)

    def list_for_payment(self, hotel_id: str, payment_id: str) -> Sequence[PaymentTransaction]:
        return self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.hotel_id == hotel_id,
                PaymentTransaction.payment_id == payment_id,
            )
        ).scalars().all()

    def get_by_gateway_txn(self, gateway: str, gateway_txn_id: str) -> PaymentTransaction | None:
        return self.db.execute(
            select(PaymentTransaction).where(
                PaymentTransaction.gateway == gateway,
                PaymentTransaction.gateway_txn_id == gateway_txn_id,
            )
        ).scalar_one_or_none()


class RefundRepository(BaseRepository[Refund]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Refund)


class TaxConfigRepository(BaseRepository[TaxConfig]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, TaxConfig)

    def active_for_type(self, hotel_id: str, item_type: str) -> Sequence[TaxConfig]:
        return self.db.execute(
            select(TaxConfig).where(
                TaxConfig.hotel_id == hotel_id,
                TaxConfig.is_active.is_(True),
                TaxConfig.applies_to.in_((item_type, "all")),
            )
        ).scalars().all()

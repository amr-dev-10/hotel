from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.user import User
from app.repositories.folio_repository import (
    FolioItemRepository,
    FolioRepository,
    PaymentTransactionRepository,
    TaxConfigRepository,
)
from app.schemas.folio import (
    FolioItemCreate,
    FolioItemRead,
    FolioRead,
    PaymentCreate,
    PaymentGatewayOrderCreate,
    PaymentRead,
    PaymentTransactionRead,
    PaymentWebhookPayload,
    RefundCreate,
    RefundRead,
    TaxConfigCreate,
    TaxConfigRead,
    TaxConfigUpdate,
)
from app.services.folio_service import FolioService
from app.services.payment_gateway_service import PaymentGatewayService

router = APIRouter()


@router.get("")
def list_folios(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    folios = FolioRepository(db).list_for_hotel(hotel_id)
    return ok([FolioRead.model_validate(item).model_dump() for item in folios])


@router.get("/payment-transactions")
def list_payment_transactions(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("folio.view")),
) -> dict:
    transactions = PaymentTransactionRepository(db).list_for_hotel(hotel_id)
    return ok([PaymentTransactionRead.model_validate(item).model_dump() for item in transactions])


@router.post("/payment-transactions/{gateway}/{gateway_txn_id}/webhook")
def payment_webhook(
    hotel_id: str,
    gateway: str,
    gateway_txn_id: str,
    payload: PaymentWebhookPayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    transaction = PaymentGatewayService(db).handle_webhook(gateway, gateway_txn_id, payload)
    return ok(PaymentTransactionRead.model_validate(transaction).model_dump())


@router.get("/{folio_id}")
def get_folio(
    hotel_id: str,
    folio_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.view")),
) -> dict:
    folio = FolioRepository(db).get_for_hotel(hotel_id, folio_id)
    items = FolioItemRepository(db).list_for_folio(hotel_id, folio_id) if folio else []
    return ok(
        {
            "folio": FolioRead.model_validate(folio).model_dump() if folio else None,
            "items": [FolioItemRead.model_validate(item).model_dump() for item in items],
        }
    )


@router.post("/{folio_id}/payment-orders")
def create_payment_order(
    hotel_id: str,
    folio_id: str,
    payload: PaymentGatewayOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("folio.manage")),
) -> dict:
    transaction = PaymentGatewayService(db).create_order(hotel_id, folio_id, payload, current_user.id)
    return ok(PaymentTransactionRead.model_validate(transaction).model_dump())


@router.post("/{folio_id}/items")
def add_folio_item(
    hotel_id: str,
    folio_id: str,
    payload: FolioItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    item = FolioService(db).add_item(hotel_id, folio_id, payload, current_user.id)
    return ok(FolioItemRead.model_validate(item).model_dump())


@router.post("/{folio_id}/payments")
def add_payment(
    hotel_id: str,
    folio_id: str,
    payload: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("guest.edit")),
) -> dict:
    payment = FolioService(db).add_payment(hotel_id, folio_id, payload, current_user.id)
    return ok(PaymentRead.model_validate(payment).model_dump())


@router.post("/{folio_id}/refunds")
def add_refund(
    hotel_id: str,
    folio_id: str,
    payload: RefundCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    refund = FolioService(db).add_refund(hotel_id, folio_id, payload, current_user.id)
    return ok(RefundRead.model_validate(refund).model_dump())


tax_router = APIRouter()


@tax_router.get("")
def list_tax_configs(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    taxes = TaxConfigRepository(db).list_for_hotel(hotel_id)
    return ok([TaxConfigRead.model_validate(item).model_dump() for item in taxes])


@tax_router.post("")
def create_tax_config(
    hotel_id: str,
    payload: TaxConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    tax = FolioService(db).create_tax_config(hotel_id, payload, current_user.id)
    return ok(TaxConfigRead.model_validate(tax).model_dump())


@tax_router.patch("/{tax_id}")
def update_tax_config(
    hotel_id: str,
    tax_id: str,
    payload: TaxConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    from app.core.exceptions import not_found

    repo = TaxConfigRepository(db)
    tax = repo.get_for_hotel(hotel_id, tax_id)
    if not tax:
        raise not_found("Tax config not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(tax, field, value)
    repo.commit(tax)
    return ok(TaxConfigRead.model_validate(tax).model_dump())


@tax_router.delete("/{tax_id}")
def delete_tax_config(
    hotel_id: str,
    tax_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("hotel.settings.manage")),
) -> dict:
    from app.core.exceptions import not_found

    repo = TaxConfigRepository(db)
    tax = repo.get_for_hotel(hotel_id, tax_id)
    if not tax:
        raise not_found("Tax config not found")
    tax.is_active = False
    repo.commit(tax)
    return ok({"deleted": True})

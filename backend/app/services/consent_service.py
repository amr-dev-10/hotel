from sqlalchemy.orm import Session

from app.core.exceptions import not_found
from app.models.base import utcnow
from app.models.guest import GuestConsent
from app.repositories.guest_repository import GuestConsentRepository, GuestRepository
from app.schemas.consent import GuestConsentUpsert


class GuestConsentService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.guests = GuestRepository(db)
        self.consents = GuestConsentRepository(db)

    def upsert(
        self,
        hotel_id: str,
        guest_id: str,
        payload: GuestConsentUpsert,
        commit: bool = True,
    ) -> GuestConsent:
        if not self.guests.get_for_hotel(hotel_id, guest_id):
            raise not_found("Guest not found")
        consent = self.consents.get_for_guest(hotel_id, guest_id)
        now = utcnow()
        if not consent:
            consent = GuestConsent(
                hotel_id=hotel_id,
                guest_id=guest_id,
                consented_at=now if any(
                    (
                        payload.whatsapp_opt_in,
                        payload.marketing_opt_in,
                        payload.email_opt_in,
                        payload.sms_opt_in,
                    )
                ) else None,
            )
            self.db.add(consent)
        for key, value in payload.model_dump().items():
            setattr(consent, key, value)
        if any((consent.whatsapp_opt_in, consent.marketing_opt_in, consent.email_opt_in, consent.sms_opt_in)):
            consent.consented_at = consent.consented_at or now
        consent.updated_at = now
        if commit:
            self.db.commit()
            self.db.refresh(consent)
        return consent

    def get(self, hotel_id: str, guest_id: str) -> GuestConsent | None:
        return self.consents.get_for_guest(hotel_id, guest_id)

    def has_whatsapp_marketing_consent(self, hotel_id: str, guest_id: str) -> bool:
        consent = self.get(hotel_id, guest_id)
        return bool(consent and consent.whatsapp_opt_in and consent.marketing_opt_in)

from datetime import datetime

from pydantic import BaseModel

from app.schemas.common import ORMModel


class GuestConsentUpsert(BaseModel):
    whatsapp_opt_in: bool = False
    marketing_opt_in: bool = False
    email_opt_in: bool = False
    sms_opt_in: bool = False
    consent_source: str = "manual"
    ip_address: str | None = None


class GuestConsentRead(ORMModel):
    id: str
    guest_id: str
    hotel_id: str
    whatsapp_opt_in: bool
    marketing_opt_in: bool
    email_opt_in: bool
    sms_opt_in: bool
    consent_source: str
    consented_at: datetime | None = None
    updated_at: datetime
    ip_address: str | None = None

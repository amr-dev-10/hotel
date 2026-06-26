from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db, set_tenant_context
from app.core.exceptions import forbidden
from app.services.guest_portal_service import GuestPortalContext, GuestPortalService

guest_bearer = HTTPBearer(auto_error=False)


def require_guest_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(guest_bearer),
    db: Session = Depends(get_db),
) -> GuestPortalContext:
    if not credentials or not credentials.credentials:
        raise forbidden("Guest session required")
    context = GuestPortalService(db).context_from_token(credentials.credentials)
    set_tenant_context(db, context.hotel_id)
    return context

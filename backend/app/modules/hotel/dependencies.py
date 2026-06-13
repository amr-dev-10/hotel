from fastapi import HTTPException, status

from app.middleware.auth import TenantContext


def ensure_hotel_scope(hotel_id: str, context: TenantContext) -> None:
    if str(context.tenant_id) != hotel_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Token is not scoped to this hotel",
        )

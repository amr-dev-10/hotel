from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_subscription
from app.modules.permission.models import Permission, RolePermission


def require_permission(action: str) -> Callable:
    def dependency(
        context: TenantContext = Depends(require_subscription),
        db: Session = Depends(get_db),
    ) -> TenantContext:
        if not context.role_ids:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No roles assigned")

        statement = (
            select(Permission)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .where(
                Permission.tenant_id == str(context.tenant_id),
                Permission.action == action,
                RolePermission.role_id.in_([str(role_id) for role_id in context.role_ids]),
            )
        )
        if db.scalar(statement) is None:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Missing permission: {action}")
        return context

    return dependency

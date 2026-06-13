from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base, TenantOwnedMixin, UuidPrimaryKeyMixin


class Permission(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "permissions"
    __table_args__ = (UniqueConstraint("tenant_id", "action", name="uq_permissions_tenant_action"),)

    action: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))


class RolePermission(Base, UuidPrimaryKeyMixin, TenantOwnedMixin):
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "role_id", "permission_id", name="uq_role_permissions_tenant_role_permission"),
    )

    role_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    permission_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)

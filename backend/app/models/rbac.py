from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDPrimaryKeyMixin

role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", ForeignKey("permissions.id"), primary_key=True),
    Column("scope", String(20), nullable=False, default="hotel", server_default="hotel"),
)

user_roles = Table(
    "user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id"), primary_key=True),
    Column("role_id", ForeignKey("roles.id"), primary_key=True),
)


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    __table_args__ = (UniqueConstraint("hotel_id", "name", name="uq_roles_hotel_name"),)

    hotel_id: Mapped[str] = mapped_column(ForeignKey("hotels.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str | None] = mapped_column(Text)
    is_system_role: Mapped[bool] = mapped_column(Boolean, default=False)
    permissions: Mapped[list["Permission"]] = relationship(
        "Permission",
        secondary=role_permissions,
        lazy="selectin",
        viewonly=True,
    )


class PermissionGroup(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "permission_groups"
    __table_args__ = (UniqueConstraint("module", "name", name="uq_permission_groups_module_name"),)

    name: Mapped[str] = mapped_column(String(120))
    module: Mapped[str] = mapped_column(String(80), index=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Permission(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "permissions"

    group_id: Mapped[str | None] = mapped_column(ForeignKey("permission_groups.id"))
    code: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    resource: Mapped[str] = mapped_column(String(80), index=True)
    action: Mapped[str] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(160))
    module: Mapped[str] = mapped_column(String(80), index=True)

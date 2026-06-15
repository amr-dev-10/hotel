from collections.abc import Sequence

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.models.rbac import Permission, PermissionGroup, Role, role_permissions, user_roles
from app.repositories.base import BaseRepository


class PermissionGroupRepository(BaseRepository[PermissionGroup]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, PermissionGroup)

    def get_by_module(self, module: str) -> PermissionGroup | None:
        return self.db.execute(
            select(PermissionGroup).where(PermissionGroup.module == module)
        ).scalar_one_or_none()

    def list_all(self) -> Sequence[PermissionGroup]:
        return self.db.execute(
            select(PermissionGroup).order_by(PermissionGroup.sort_order, PermissionGroup.module)
        ).scalars().all()


class PermissionRepository(BaseRepository[Permission]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Permission)

    def get_by_code(self, code: str) -> Permission | None:
        return self.db.execute(select(Permission).where(Permission.code == code)).scalar_one_or_none()

    def get_by_codes(self, codes: list[str]) -> Sequence[Permission]:
        if not codes:
            return []
        return self.db.execute(select(Permission).where(Permission.code.in_(codes))).scalars().all()

    def list_all(self) -> Sequence[Permission]:
        return self.db.execute(select(Permission).order_by(Permission.module, Permission.code)).scalars().all()


class RoleRepository(BaseRepository[Role]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Role)

    def get_by_name(self, hotel_id: str, name: str) -> Role | None:
        return self.db.execute(
            select(Role).where(Role.hotel_id == hotel_id, Role.name == name)
        ).scalar_one_or_none()

    def set_permissions(self, role_id: str, permission_ids: list[str]) -> None:
        self.db.execute(delete(role_permissions).where(role_permissions.c.role_id == role_id))
        if permission_ids:
            self.db.execute(
                insert(role_permissions),
                [{"role_id": role_id, "permission_id": permission_id} for permission_id in permission_ids],
            )

    def assign_user_roles(self, user_id: str, role_ids: list[str]) -> None:
        self.db.execute(delete(user_roles).where(user_roles.c.user_id == user_id))
        if role_ids:
            self.db.execute(
                insert(user_roles),
                [{"user_id": user_id, "role_id": role_id} for role_id in role_ids],
            )

    def permission_codes_for_user(self, user_id: str) -> set[str]:
        rows = self.db.execute(
            select(Permission.code)
            .select_from(user_roles)
            .join(role_permissions, role_permissions.c.role_id == user_roles.c.role_id)
            .join(Permission, Permission.id == role_permissions.c.permission_id)
            .where(user_roles.c.user_id == user_id)
        ).all()
        return {row[0] for row in rows}

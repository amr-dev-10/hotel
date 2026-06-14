from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, forbidden, not_found
from app.models.rbac import Permission, Role
from app.models.user import User
from app.repositories.rbac_repository import PermissionRepository, RoleRepository
from app.services.audit_service import AuditService
from app.services.defaults import DEFAULT_PERMISSIONS, OWNER_ROLE_NAME


class RBACService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permissions = PermissionRepository(db)
        self.roles = RoleRepository(db)

    def seed_permissions(self) -> list[Permission]:
        created: list[Permission] = []
        for code, name, module in DEFAULT_PERMISSIONS:
            permission = self.permissions.get_by_code(code)
            if not permission:
                permission = Permission(code=code, name=name, module=module)
                self.db.add(permission)
                self.db.flush()
                created.append(permission)
        return created

    def seed_owner_role(self, hotel_id: str, owner: User) -> Role:
        self.seed_permissions()
        role = self.roles.get_by_name(hotel_id, OWNER_ROLE_NAME)
        if not role:
            role = Role(
                hotel_id=hotel_id,
                name=OWNER_ROLE_NAME,
                description="System owner role with every permission.",
                is_system_role=True,
            )
            self.db.add(role)
            self.db.flush()
        all_permissions = self.permissions.list_all()
        self.roles.set_permissions(role.id, [permission.id for permission in all_permissions])
        self.roles.assign_user_roles(owner.id, [role.id])
        return role

    def create_role(
        self,
        hotel_id: str,
        name: str,
        description: str | None,
        permission_codes: Iterable[str],
        actor_id: str | None,
    ) -> Role:
        if self.roles.get_by_name(hotel_id, name):
            raise bad_request("Role already exists for this hotel")
        role = Role(
            hotel_id=hotel_id,
            name=name,
            description=description,
            is_system_role=False,
        )
        self.db.add(role)
        self.db.flush()
        self.set_role_permissions(role, permission_codes)
        AuditService(self.db).log(
            hotel_id,
            "role.created",
            "role",
            role.id,
            actor_id,
            {"name": role.name},
        )
        self.db.commit()
        self.db.refresh(role)
        return role

    def set_role_permissions(self, role: Role, permission_codes: Iterable[str]) -> None:
        permissions = []
        for code in permission_codes:
            permission = self.permissions.get_by_code(code)
            if not permission:
                raise not_found(f"Permission does not exist: {code}")
            permissions.append(permission)
        self.roles.set_permissions(role.id, [permission.id for permission in permissions])

    def assign_roles(
        self,
        hotel_id: str,
        user_id: str,
        role_ids: list[str],
        actor_id: str | None,
    ) -> None:
        for role_id in role_ids:
            role = self.roles.get_for_hotel(hotel_id, role_id)
            if not role:
                raise not_found("Role not found")
        self.roles.assign_user_roles(user_id, role_ids)
        AuditService(self.db).log(
            hotel_id,
            "user.roles.assigned",
            "user",
            user_id,
            actor_id,
            {"role_ids": role_ids},
        )
        self.db.commit()

    def permission_codes_for_user(self, user: User) -> set[str]:
        if user.is_hotel_owner:
            self.seed_owner_role(user.hotel_id, user)
            self.db.flush()
        return self.roles.permission_codes_for_user(user.id)

    def require(self, user: User, permission_code: str) -> None:
        if user.is_hotel_owner:
            return
        permissions = self.permission_codes_for_user(user)
        if permission_code not in permissions:
            raise forbidden(f"Missing permission: {permission_code}")

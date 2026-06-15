from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.core.exceptions import bad_request, forbidden, not_found
from app.models.rbac import Permission, PermissionGroup, Role
from app.models.user import User
from app.repositories.rbac_repository import PermissionGroupRepository, PermissionRepository, RoleRepository
from app.services.audit_service import AuditService
from app.services.defaults import DEFAULT_PERMISSIONS, OWNER_ROLE_NAME, PERMISSION_GROUPS


class RBACService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permission_groups = PermissionGroupRepository(db)
        self.permissions = PermissionRepository(db)
        self.roles = RoleRepository(db)

    def seed_permissions(self) -> list[Permission]:
        self.seed_permission_groups()
        created: list[Permission] = []
        for code, name, module in DEFAULT_PERMISSIONS:
            group = self.permission_groups.get_by_module(module)
            permission = self.permissions.get_by_code(code)
            if not permission:
                permission = Permission(
                    code=code,
                    name=name,
                    module=module,
                    group_id=group.id if group else None,
                )
                self.db.add(permission)
                self.db.flush()
                created.append(permission)
            elif group and permission.group_id != group.id:
                permission.group_id = group.id
        return created

    def seed_permission_groups(self) -> list[PermissionGroup]:
        created: list[PermissionGroup] = []
        for index, (module, name) in enumerate(PERMISSION_GROUPS.items(), start=1):
            group = self.permission_groups.get_by_module(module)
            if not group:
                group = PermissionGroup(name=name, module=module, sort_order=index * 10)
                self.db.add(group)
                self.db.flush()
                created.append(group)
        return created

    def seed_owner_role(self, hotel_id: str, owner: User) -> Role:
        self.seed_permissions()
        all_permissions = self.permissions.list_all()
        role = self._ensure_system_role(
            hotel_id,
            OWNER_ROLE_NAME,
            "System owner role with every permission.",
            [permission.code for permission in all_permissions],
        )
        self.roles.assign_user_roles(owner.id, [role.id])
        self._ensure_system_role(
            hotel_id,
            "Manager",
            "Hotel manager role for daily operations.",
            [
                code
                for code, _, _ in DEFAULT_PERMISSIONS
                if not code.startswith("hotel.billing") and code != "role.manage"
            ],
        )
        self._ensure_system_role(
            hotel_id,
            "Receptionist",
            "Front desk role for guests, rooms, and tickets.",
            [
                "ticket.view",
                "ticket.create",
                "ticket.assign",
                "guest.view",
                "guest.create",
                "guest.edit",
                "guest.checkout",
                "room.view",
                "room.update",
                "reservation.view",
                "reservation.manage",
                "folio.view",
                "folio.manage",
            ],
        )
        self._ensure_system_role(
            hotel_id,
            "Staff",
            "Operational staff role for assigned tickets.",
            ["ticket.view", "ticket.create"],
        )
        return role

    def _ensure_system_role(
        self,
        hotel_id: str,
        name: str,
        description: str,
        permission_codes: Iterable[str],
    ) -> Role:
        role = self.roles.get_by_name(hotel_id, name)
        if not role:
            role = Role(
                hotel_id=hotel_id,
                name=name,
                description=description,
                is_system_role=True,
            )
            self.db.add(role)
            self.db.flush()
        permissions = []
        for code in permission_codes:
            permission = self.permissions.get_by_code(code)
            if permission:
                permissions.append(permission)
        self.roles.set_permissions(role.id, [permission.id for permission in permissions])
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
        permission_codes = list(dict.fromkeys(permission_codes))
        permissions = []
        for code in permission_codes:
            permission = self.permissions.get_by_code(code)
            if not permission:
                raise not_found(f"Permission does not exist: {code}")
            permissions.append(permission)
        self.roles.set_permissions(role.id, [permission.id for permission in permissions])

    def replace_role_permissions(
        self,
        hotel_id: str,
        role_id: str,
        permission_codes: Iterable[str],
        actor_id: str | None,
    ) -> Role:
        permission_codes = list(dict.fromkeys(permission_codes))
        role = self.roles.get_for_hotel(hotel_id, role_id)
        if not role:
            raise not_found("Role not found")
        old_codes = sorted(permission.code for permission in role.permissions)
        self.set_role_permissions(role, permission_codes)
        AuditService(self.db).log(
            hotel_id,
            "role.permissions.updated",
            "role",
            role.id,
            actor_id,
            old_payload={"permission_codes": old_codes},
            new_payload={"permission_codes": permission_codes},
        )
        self.db.commit()
        self.db.refresh(role)
        return role

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

    def update_role(
        self,
        hotel_id: str,
        role_id: str,
        name: str | None,
        description: str | None,
        permission_codes: Iterable[str] | None,
        actor_id: str | None,
    ) -> Role:
        role = self.roles.get_for_hotel(hotel_id, role_id)
        if not role:
            raise not_found("Role not found")
        old_payload = {
            "name": role.name,
            "description": role.description,
        }
        if name is not None:
            role.name = name
        if description is not None:
            role.description = description
        if permission_codes is not None:
            self.set_role_permissions(role, permission_codes)
        AuditService(self.db).log(
            hotel_id,
            "role.updated",
            "role",
            role.id,
            actor_id,
            old_payload=old_payload,
            new_payload={"name": role.name, "description": role.description},
        )
        self.db.commit()
        self.db.refresh(role)
        return role

    def delete_role(self, hotel_id: str, role_id: str, actor_id: str | None) -> None:
        role = self.roles.get_for_hotel(hotel_id, role_id)
        if not role:
            raise not_found("Role not found")
        if role.is_system_role:
            raise bad_request("System roles cannot be deleted")
        AuditService(self.db).log(
            hotel_id,
            "role.deleted",
            "role",
            role.id,
            actor_id,
            {"name": role.name},
        )
        self.db.delete(role)
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

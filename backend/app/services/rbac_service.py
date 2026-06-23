from collections.abc import Iterable
from time import monotonic

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.permissions import Permissions
from app.core.exceptions import bad_request, forbidden, not_found
from app.models.rbac import Permission, PermissionGroup, Role
from app.models.user import User
from app.repositories.rbac_repository import PermissionGroupRepository, PermissionRepository, RoleRepository
from app.repositories.user_repository import UserRepository
from app.services.audit_service import AuditService
from app.services.defaults import DEFAULT_PERMISSIONS, OWNER_ROLE_NAME, PERMISSION_GROUPS

PermissionScopeMap = dict[str, set[str]]

_PERMISSION_CACHE: dict[str, tuple[float, set[str], PermissionScopeMap]] = {}

PERMISSION_SCOPES = {"own", "department", "hotel"}
SCOPE_RANK = {"none": 0, "own": 1, "department": 2, "hotel": 3}
LEGACY_SCOPED_PERMISSIONS = {
    Permissions.TICKET_VIEW_OWN: (Permissions.TICKET_VIEW, "own"),
    Permissions.TICKET_VIEW_DEPT: (Permissions.TICKET_VIEW, "department"),
    Permissions.TICKET_VIEW_ALL: (Permissions.TICKET_VIEW, "hotel"),
    Permissions.SHIFT_VIEW_OWN: (Permissions.SHIFT_VIEW, "own"),
    Permissions.SHIFT_VIEW_DEPT: (Permissions.SHIFT_VIEW, "department"),
    Permissions.SHIFT_UPDATE_OWN: (Permissions.SHIFT_UPDATE, "own"),
}
SCOPED_PERMISSION_ALIASES = {
    (Permissions.TICKET_VIEW, "own"): Permissions.TICKET_VIEW_OWN,
    (Permissions.TICKET_VIEW, "department"): Permissions.TICKET_VIEW_DEPT,
    (Permissions.TICKET_VIEW, "hotel"): Permissions.TICKET_VIEW_ALL,
    (Permissions.SHIFT_VIEW, "own"): Permissions.SHIFT_VIEW_OWN,
    (Permissions.SHIFT_VIEW, "department"): Permissions.SHIFT_VIEW_DEPT,
    (Permissions.SHIFT_UPDATE, "own"): Permissions.SHIFT_UPDATE_OWN,
}
EQUIVALENT_PERMISSIONS = {
    Permissions.USER_VIEW: {Permissions.STAFF_VIEW},
    Permissions.USER_CREATE: {Permissions.STAFF_CREATE},
    Permissions.USER_UPDATE: {Permissions.STAFF_UPDATE},
    Permissions.USER_DELETE: {Permissions.STAFF_DELETE},
    Permissions.USER_MANAGE: {Permissions.STAFF_MANAGE},
    Permissions.STAFF_VIEW: {Permissions.USER_VIEW},
    Permissions.STAFF_CREATE: {Permissions.USER_CREATE},
    Permissions.STAFF_UPDATE: {Permissions.USER_UPDATE},
    Permissions.STAFF_DELETE: {Permissions.USER_DELETE},
    Permissions.STAFF_MANAGE: {Permissions.USER_MANAGE},
}
CANONICAL_DISPLAY_PERMISSIONS = {
    Permissions.USER_VIEW: Permissions.STAFF_VIEW,
    Permissions.USER_CREATE: Permissions.STAFF_CREATE,
    Permissions.USER_UPDATE: Permissions.STAFF_UPDATE,
    Permissions.USER_DELETE: Permissions.STAFF_DELETE,
    Permissions.USER_MANAGE: Permissions.STAFF_MANAGE,
}


class RBACService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.permission_groups = PermissionGroupRepository(db)
        self.permissions = PermissionRepository(db)
        self.roles = RoleRepository(db)
        self.users = UserRepository(db)

    def seed_permissions(self) -> list[Permission]:
        self.seed_permission_groups()
        created: list[Permission] = []
        for code, name, module in DEFAULT_PERMISSIONS:
            group = self.permission_groups.get_by_module(module)
            permission = self.permissions.get_by_code(code)
            if not permission:
                resource, action = split_permission_code(code)
                permission = Permission(
                    code=code,
                    resource=resource,
                    action=action,
                    name=name,
                    module=module,
                    group_id=group.id if group else None,
                )
                self.db.add(permission)
                self.db.flush()
                created.append(permission)
            elif group and permission.group_id != group.id:
                permission.group_id = group.id
            if permission:
                resource, action = split_permission_code(code)
                permission.resource = resource
                permission.action = action
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
        self.clear_permission_cache()
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
                Permissions.TICKET_VIEW,
                Permissions.TICKET_VIEW_ALL,
                Permissions.TICKET_CREATE,
                Permissions.TICKET_ASSIGN,
                Permissions.TICKET_ACCEPT,
                Permissions.TICKET_REJECT,
                Permissions.TICKET_COMPLETE_OWN,
                Permissions.GUEST_VIEW,
                Permissions.GUEST_VIEW_BASIC,
                Permissions.GUEST_CREATE,
                Permissions.GUEST_EDIT,
                Permissions.GUEST_CHECKOUT,
                Permissions.ROOM_VIEW,
                Permissions.ROOM_UPDATE,
                Permissions.RESERVATION_VIEW,
                Permissions.RESERVATION_MANAGE,
                Permissions.FOLIO_VIEW,
                Permissions.FOLIO_MANAGE,
            ],
        )
        self._ensure_system_role(
            hotel_id,
            "Staff",
            "Operational staff role for assigned tickets.",
            [
                Permissions.TICKET_VIEW_OWN,
                Permissions.TICKET_CREATE,
                Permissions.TICKET_ACCEPT,
                Permissions.TICKET_REJECT,
                Permissions.TICKET_COMPLETE_OWN,
                Permissions.SHIFT_VIEW_OWN,
                Permissions.SHIFT_UPDATE_OWN,
            ],
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
        self.set_role_permissions(role, permission_codes)
        return role

    def create_role(
        self,
        hotel_id: str,
        name: str,
        description: str | None,
        permission_codes: Iterable[str],
        permission_scopes: dict[str, str] | None,
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
        self.set_role_permissions(role, permission_codes, permission_scopes)
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

    def set_role_permissions(
        self,
        role: Role,
        permission_codes: Iterable[str],
        permission_scopes: dict[str, str] | None = None,
    ) -> None:
        self.clear_permission_cache()
        permission_scopes = permission_scopes or {}
        normalized = self._normalize_permission_assignments(permission_codes, permission_scopes)
        assignments: list[tuple[str, str]] = []
        for code, scope in normalized.items():
            permission = self.permissions.get_by_code(code)
            if not permission:
                raise not_found(f"Permission does not exist: {code}")
            assignments.append((permission.id, scope))
        self.roles.set_permissions(role.id, assignments)

    def replace_role_permissions(
        self,
        hotel_id: str,
        role_id: str,
        permission_codes: Iterable[str],
        permission_scopes: dict[str, str] | None,
        actor_id: str | None,
    ) -> Role:
        permission_codes = list(dict.fromkeys(permission_codes))
        role = self.roles.get_for_hotel(hotel_id, role_id)
        if not role:
            raise not_found("Role not found")
        old_grants = self.role_permission_reads(role)
        self.set_role_permissions(role, permission_codes, permission_scopes)
        AuditService(self.db).log(
            hotel_id,
            "role.permissions.updated",
            "role",
            role.id,
            actor_id,
            old_payload={"permissions": old_grants},
            new_payload={"permission_codes": permission_codes, "permission_scopes": permission_scopes or {}},
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
        if not self.users.get_for_hotel(hotel_id, user_id):
            raise not_found("User not found")
        for role_id in role_ids:
            role = self.roles.get_for_hotel(hotel_id, role_id)
            if not role:
                raise not_found("Role not found")
        self.roles.assign_user_roles(user_id, role_ids)
        self.clear_permission_cache(user_id)
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
        permission_scopes: dict[str, str] | None,
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
            self.set_role_permissions(role, permission_codes, permission_scopes)
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
        self.clear_permission_cache()
        self.db.commit()

    def _permission_grants_for_user(self, user: User) -> tuple[set[str], PermissionScopeMap]:
        now = monotonic()
        cached = _PERMISSION_CACHE.get(user.id)
        if cached and cached[0] > now:
            return set(cached[1]), {code: set(scopes) for code, scopes in cached[2].items()}

        grants = self.roles.permission_grants_for_user(user.id)
        permissions, permission_scopes = expand_permission_grants(grants)
        _PERMISSION_CACHE[user.id] = (
            now + settings.permission_cache_ttl_seconds,
            set(permissions),
            {code: set(scopes) for code, scopes in permission_scopes.items()},
        )
        return permissions, permission_scopes

    def permission_codes_for_user(self, user: User) -> set[str]:
        permissions, _ = self._permission_grants_for_user(user)
        return permissions

    def permission_scopes_for_user(self, user: User) -> dict[str, str]:
        _, permission_scopes = self._permission_grants_for_user(user)
        return {code: highest_scope(scopes) for code, scopes in permission_scopes.items()}

    def role_permission_reads(self, role: Role) -> list[dict[str, str | None]]:
        grants = self.roles.scoped_permissions_for_role(role.id)
        permissions_by_code = {permission.code: permission for permission, _ in grants}
        _, normalized_scopes = expand_permission_grants((permission.code, scope) for permission, scope in grants)
        display_scopes: PermissionScopeMap = {}
        for code, scopes in normalized_scopes.items():
            display_code = CANONICAL_DISPLAY_PERMISSIONS.get(code, code)
            display_scopes.setdefault(display_code, set()).update(scopes)
        reads: list[dict[str, str | None]] = []
        for code, scopes in sorted(display_scopes.items()):
            permission = permissions_by_code.get(code) or self.permissions.get_by_code(code)
            if not permission:
                continue
            reads.append(
                {
                    "id": permission.id,
                    "group_id": permission.group_id,
                    "code": permission.code,
                    "resource": permission.resource,
                    "action": permission.action,
                    "name": permission.name,
                    "module": permission.module,
                    "scope": highest_scope(scopes),
                }
            )
        return reads

    @staticmethod
    def clear_permission_cache(user_id: str | None = None) -> None:
        if user_id is None:
            _PERMISSION_CACHE.clear()
            return
        _PERMISSION_CACHE.pop(user_id, None)

    def require(self, user: User, permission_code: str) -> None:
        if user.is_hotel_owner:
            return
        if not self.has_permission(user, permission_code):
            raise forbidden(f"Missing permission: {permission_code}")

    def has_permission(self, user: User, permission_code: str) -> bool:
        if user.is_hotel_owner:
            return True
        permissions = self.permission_codes_for_user(user)
        accepted_codes = {permission_code, *EQUIVALENT_PERMISSIONS.get(permission_code, set())}
        manage_code = implied_manage_permission(permission_code)
        if manage_code:
            accepted_codes.add(manage_code)
            accepted_codes.update(EQUIVALENT_PERMISSIONS.get(manage_code, set()))
        return bool(permissions.intersection(accepted_codes))

    def has_any(self, user: User, permission_codes: Iterable[str]) -> bool:
        if user.is_hotel_owner:
            return True
        return any(self.has_permission(user, permission_code) for permission_code in permission_codes)

    def ticket_visibility_scope(self, user: User) -> str:
        if user.is_hotel_owner:
            return "all"
        return self.visibility_scope_for(user, "ticket")

    def can_view_ticket(self, user: User, ticket) -> bool:
        scope = self.ticket_visibility_scope(user)
        if scope == "all":
            return True
        if scope == "department":
            return bool(user.department_id and ticket.department_id == user.department_id)
        if scope == "own":
            followers = ticket.followers or []
            return ticket.assigned_to == user.id or user.id in followers
        return False

    def shift_visibility_scope(self, user: User) -> str:
        if user.is_hotel_owner:
            return "all"
        view_scope = self.visibility_scope_for(
            user,
            "shift",
            all_permissions=(Permissions.SHIFT_MANAGE,),
            own_permissions=(Permissions.SHIFT_UPDATE_OWN,),
        )
        if view_scope != "none":
            return view_scope
        update_scope = self.permission_scope(user, Permissions.SHIFT_UPDATE)
        if update_scope != "none":
            return "all" if update_scope == "hotel" else update_scope
        return "none"

    def staff_visibility_scope(self, user: User) -> str:
        if user.is_hotel_owner:
            return "all"
        return self.visibility_scope_for(
            user,
            "staff",
            all_permissions=(Permissions.USER_MANAGE, Permissions.STAFF_MANAGE),
        )

    def can_view_staff(self, user: User, target: User) -> bool:
        scope = self.staff_visibility_scope(user)
        if scope == "all":
            return True
        if scope == "department":
            return bool(user.department_id and target.department_id == user.department_id)
        if scope == "own":
            return user.id == target.id
        return False

    def can_update_staff(self, user: User, target: User) -> bool:
        if self.has_any(user, [Permissions.USER_MANAGE, Permissions.STAFF_MANAGE]):
            return True
        scope = self.permission_scope(user, Permissions.STAFF_UPDATE)
        if scope == "hotel":
            return True
        if scope == "department":
            return bool(user.department_id and target.department_id == user.department_id)
        if scope == "own":
            return user.id == target.id
        return False

    def visibility_scope_for(
        self,
        user: User,
        resource: str,
        *,
        all_permissions: Iterable[str] = (),
        dept_permissions: Iterable[str] = (),
        own_permissions: Iterable[str] = (),
    ) -> str:
        permissions, permission_scopes = self._permission_grants_for_user(user)
        scoped_view = highest_scope(permission_scopes.get(f"{resource}.view", set()))
        if scoped_view != "none":
            return "all" if scoped_view == "hotel" else scoped_view
        if (
            f"{resource}.view_all" in permissions
            or f"{resource}.view" in permissions
            or any(permission in permissions for permission in all_permissions)
        ):
            return "all"
        if f"{resource}.view_dept" in permissions or any(permission in permissions for permission in dept_permissions):
            return "department"
        if f"{resource}.view_own" in permissions or any(permission in permissions for permission in own_permissions):
            return "own"
        return "none"

    def permission_scope(self, user: User, permission_code: str) -> str:
        _, permission_scopes = self._permission_grants_for_user(user)
        return highest_scope(permission_scopes.get(permission_code, set()))

    def _normalize_permission_assignments(
        self,
        permission_codes: Iterable[str],
        permission_scopes: dict[str, str],
    ) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for requested_code in dict.fromkeys(permission_codes):
            code, scope = permission_request_base_and_scope(requested_code, permission_scopes.get(requested_code))
            permission = self.permissions.get_by_code(code)
            if not permission:
                raise not_found(f"Permission does not exist: {requested_code}")
            normalized[code] = wider_scope(normalized.get(code, "none"), scope)
        return normalized


def split_permission_code(code: str) -> tuple[str, str]:
    if "." not in code:
        return code, "manage"
    resource, action = code.split(".", 1)
    return resource, action


def implied_manage_permission(permission_code: str) -> str | None:
    resource, action = split_permission_code(permission_code)
    if action == "manage" or action.endswith(".manage"):
        return None
    return f"{resource}.manage"


def normalize_scope(scope: str | None) -> str:
    normalized = (scope or "hotel").strip().lower()
    if normalized in {"all", "global"}:
        normalized = "hotel"
    if normalized in {"dept", "department"}:
        normalized = "department"
    if normalized not in PERMISSION_SCOPES:
        raise bad_request(f"Invalid permission scope: {scope}")
    return normalized


def wider_scope(current: str, candidate: str) -> str:
    return candidate if SCOPE_RANK[candidate] > SCOPE_RANK.get(current, 0) else current


def highest_scope(scopes: Iterable[str]) -> str:
    selected = "none"
    for scope in scopes:
        selected = wider_scope(selected, normalize_scope(scope))
    return selected


def permission_request_base_and_scope(code: str, requested_scope: str | None = None) -> tuple[str, str]:
    if code in LEGACY_SCOPED_PERMISSIONS:
        base_code, legacy_scope = LEGACY_SCOPED_PERMISSIONS[code]
        return base_code, normalize_scope(legacy_scope)
    return code, normalize_scope(requested_scope)


def expand_permission_grants(grants: Iterable[tuple[str, str]]) -> tuple[set[str], PermissionScopeMap]:
    permissions: set[str] = set()
    permission_scopes: PermissionScopeMap = {}
    for raw_code, raw_scope in grants:
        code, scope = permission_request_base_and_scope(raw_code, raw_scope)
        permissions.add(code)
        permission_scopes.setdefault(code, set()).add(scope)

        for equivalent in EQUIVALENT_PERMISSIONS.get(code, set()):
            permissions.add(equivalent)
            permission_scopes.setdefault(equivalent, set()).add(scope)

        legacy_alias = SCOPED_PERMISSION_ALIASES.get((code, scope))
        if legacy_alias:
            permissions.add(legacy_alias)
    return permissions, permission_scopes

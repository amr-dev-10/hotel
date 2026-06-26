from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class PermissionRead(ORMModel):
    id: str
    group_id: str | None = None
    code: str
    resource: str
    action: str
    name: str
    module: str
    scope: str = "hotel"


class PermissionGroupRead(ORMModel):
    id: str
    name: str
    module: str
    sort_order: int


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list)
    permission_scopes: dict[str, str] = Field(default_factory=dict)


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permission_codes: list[str] | None = None
    permission_scopes: dict[str, str] | None = None


class RolePermissionsUpdate(BaseModel):
    permission_codes: list[str] | None = None
    permission_keys: list[str] | None = None
    permission_scopes: dict[str, str] | None = None

    def requested_codes(self) -> list[str]:
        return self.permission_keys if self.permission_keys is not None else (self.permission_codes or [])


class RoleRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    description: str | None = None
    is_system_role: bool
    permissions: list[PermissionRead] = Field(default_factory=list)


class UserRoleAssign(BaseModel):
    role_ids: list[str]

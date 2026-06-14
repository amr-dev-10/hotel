from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class PermissionRead(ORMModel):
    id: str
    group_id: str | None = None
    code: str
    name: str
    module: str


class PermissionGroupRead(ORMModel):
    id: str
    name: str
    module: str
    sort_order: int


class RoleCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    permission_codes: list[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    permission_codes: list[str] | None = None


class RoleRead(ORMModel):
    id: str
    hotel_id: str
    name: str
    description: str | None = None
    is_system_role: bool


class UserRoleAssign(BaseModel):
    role_ids: list[str]

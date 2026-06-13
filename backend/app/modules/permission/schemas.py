from pydantic import BaseModel, Field


class PermissionCreate(BaseModel):
    action: str = Field(min_length=1, max_length=120)
    description: str | None = None


class PermissionRead(BaseModel):
    id: str
    tenant_id: str
    action: str
    description: str | None

    model_config = {"from_attributes": True}

from pydantic import BaseModel, Field


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class RoleRead(BaseModel):
    id: str
    tenant_id: str
    name: str
    description: str | None

    model_config = {"from_attributes": True}

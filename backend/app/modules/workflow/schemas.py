from pydantic import BaseModel, Field


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class WorkflowRead(BaseModel):
    id: str
    tenant_id: str
    name: str

    model_config = {"from_attributes": True}


class StageCreate(BaseModel):
    workflow_id: str
    name: str = Field(min_length=1, max_length=120)
    sequence: int


class StageRead(BaseModel):
    id: str
    tenant_id: str
    workflow_id: str
    name: str
    sequence: int

    model_config = {"from_attributes": True}

from pydantic import BaseModel, Field


class PlanCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    max_users: int = 10
    max_tickets: int = 100
    storage_gb: int = 5


class PlanRead(BaseModel):
    id: str
    name: str
    max_users: int
    max_tickets: int
    storage_gb: int

    model_config = {"from_attributes": True}

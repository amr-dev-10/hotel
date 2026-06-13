from pydantic import BaseModel


class ActivityRead(BaseModel):
    id: str
    tenant_id: str
    actor_id: str
    action: str
    entity_type: str
    entity_id: str

    model_config = {"from_attributes": True}

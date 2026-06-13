from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: str
    tenant_id: str
    entity_name: str
    entity_id: str
    action: str
    old_data: dict | None
    new_data: dict | None
    performed_by: str

    model_config = {"from_attributes": True}

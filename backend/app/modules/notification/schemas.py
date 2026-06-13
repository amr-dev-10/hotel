from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    recipient: str = Field(min_length=1)
    channel: str = "email"
    subject: str | None = None
    body: str = Field(min_length=1)


class NotificationRead(BaseModel):
    id: str
    tenant_id: str
    recipient: str
    channel: str
    subject: str | None
    body: str
    status: str

    model_config = {"from_attributes": True}

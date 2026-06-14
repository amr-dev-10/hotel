from pydantic import BaseModel


class BotReply(BaseModel):
    kind: str
    text: str | None = None
    payload: dict | None = None


class BotProcessResult(BaseModel):
    hotel_id: str
    phone: str
    session_state: str
    replies: list[BotReply]
    ticket_id: str | None = None

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.bot_config import BotConfig
from app.repositories.base import BaseRepository


class BotConfigRepository(BaseRepository[BotConfig]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, BotConfig)

    def get_for_hotel(self, hotel_id: str) -> BotConfig | None:
        return self.db.execute(
            select(BotConfig).where(BotConfig.hotel_id == hotel_id)
        ).scalar_one_or_none()

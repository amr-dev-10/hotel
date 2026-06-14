from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.menu import MenuCategory, MenuItem
from app.repositories.base import BaseRepository


class MenuCategoryRepository(BaseRepository[MenuCategory]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, MenuCategory)


class MenuItemRepository(BaseRepository[MenuItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, MenuItem)

    def list_available(self, hotel_id: str, category_id: str | None = None) -> Sequence[MenuItem]:
        statement = select(MenuItem).where(
            MenuItem.hotel_id == hotel_id,
            MenuItem.is_available.is_(True),
        )
        if category_id:
            statement = statement.where(MenuItem.category_id == category_id)
        return self.db.execute(
            statement.order_by(MenuItem.display_order, MenuItem.name)
        ).scalars().all()

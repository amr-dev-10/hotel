from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.restaurant import RestaurantOrder, RestaurantOrderItem, RestaurantTable
from app.repositories.base import BaseRepository


class RestaurantTableRepository(BaseRepository[RestaurantTable]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RestaurantTable)


class RestaurantOrderRepository(BaseRepository[RestaurantOrder]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RestaurantOrder)


class RestaurantOrderItemRepository(BaseRepository[RestaurantOrderItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, RestaurantOrderItem)

    def list_for_order(self, hotel_id: str, order_id: str) -> Sequence[RestaurantOrderItem]:
        return self.db.execute(
            select(RestaurantOrderItem).where(
                RestaurantOrderItem.hotel_id == hotel_id,
                RestaurantOrderItem.order_id == order_id,
            )
        ).scalars().all()

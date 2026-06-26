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

    def list_filtered(
        self,
        hotel_id: str,
        status: str | None = None,
        source: str | None = None,
        guest_id: str | None = None,
        room_id: str | None = None,
        limit: int = 100,
    ) -> Sequence[RestaurantOrder]:
        statement = select(RestaurantOrder).where(RestaurantOrder.hotel_id == hotel_id)
        if status:
            statement = statement.where(RestaurantOrder.status == status)
        if source:
            statement = statement.where(RestaurantOrder.source == source)
        if guest_id:
            statement = statement.where(RestaurantOrder.guest_id == guest_id)
        if room_id:
            statement = statement.where(RestaurantOrder.room_id == room_id)
        return self.db.execute(
            statement.order_by(RestaurantOrder.created_at.desc()).limit(limit)
        ).scalars().all()

    def list_for_guest(
        self,
        hotel_id: str,
        guest_id: str,
        room_id: str | None = None,
    ) -> Sequence[RestaurantOrder]:
        statement = select(RestaurantOrder).where(
            RestaurantOrder.hotel_id == hotel_id,
            RestaurantOrder.guest_id == guest_id,
        )
        if room_id:
            statement = statement.where(RestaurantOrder.room_id == room_id)
        return self.db.execute(
            statement.order_by(RestaurantOrder.created_at.desc())
        ).scalars().all()


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

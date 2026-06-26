from collections.abc import Sequence

from sqlalchemy import delete, insert, select
from sqlalchemy.orm import Session

from app.models.folio import TaxConfig
from app.models.menu import MenuCategory, MenuItem, menu_item_taxes
from app.repositories.base import BaseRepository


class MenuCategoryRepository(BaseRepository[MenuCategory]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, MenuCategory)

    def list_ordered(self, hotel_id: str, active_only: bool = False) -> Sequence[MenuCategory]:
        statement = select(MenuCategory).where(
            MenuCategory.hotel_id == hotel_id,
            MenuCategory.deleted_at.is_(None),
        )
        if active_only:
            statement = statement.where(MenuCategory.is_active.is_(True))
        return self.db.execute(
            statement.order_by(MenuCategory.display_order, MenuCategory.name)
        ).scalars().all()


class MenuItemRepository(BaseRepository[MenuItem]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, MenuItem)

    def list_available(self, hotel_id: str, category_id: str | None = None) -> Sequence[MenuItem]:
        statement = select(MenuItem).where(
            MenuItem.hotel_id == hotel_id,
            MenuItem.is_available.is_(True),
            MenuItem.deleted_at.is_(None),
        )
        if category_id:
            statement = statement.where(MenuItem.category_id == category_id)
        return self.db.execute(
            statement.order_by(MenuItem.display_order, MenuItem.name)
        ).scalars().all()

    def list_for_category_admin(self, hotel_id: str, category_id: str | None = None) -> Sequence[MenuItem]:
        statement = select(MenuItem).where(
            MenuItem.hotel_id == hotel_id,
            MenuItem.deleted_at.is_(None),
        )
        if category_id:
            statement = statement.where(MenuItem.category_id == category_id)
        return self.db.execute(
            statement.order_by(MenuItem.display_order, MenuItem.name)
        ).scalars().all()

    def tax_ids_for_item(self, menu_item_id: str) -> list[str]:
        return list(
            self.db.execute(
                select(menu_item_taxes.c.tax_config_id).where(
                    menu_item_taxes.c.menu_item_id == menu_item_id,
                )
            ).scalars().all()
        )

    def tax_configs_for_item(self, hotel_id: str, menu_item_id: str) -> Sequence[TaxConfig]:
        return self.db.execute(
            select(TaxConfig)
            .join(menu_item_taxes, menu_item_taxes.c.tax_config_id == TaxConfig.id)
            .where(
                menu_item_taxes.c.menu_item_id == menu_item_id,
                TaxConfig.hotel_id == hotel_id,
                TaxConfig.is_active.is_(True),
            )
        ).scalars().all()

    def set_item_taxes(self, menu_item_id: str, tax_config_ids: Sequence[str]) -> None:
        self.db.execute(delete(menu_item_taxes).where(menu_item_taxes.c.menu_item_id == menu_item_id))
        for tax_config_id in dict.fromkeys(tax_config_ids):
            self.db.execute(
                insert(menu_item_taxes).values(
                    menu_item_id=menu_item_id,
                    tax_config_id=tax_config_id,
                )
            )

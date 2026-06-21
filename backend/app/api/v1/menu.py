from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import require_permission
from app.core.database import get_db
from app.core.responses import ok
from app.models.menu import MenuCategory, MenuItem
from app.models.user import User
from app.models.base import utcnow
from app.repositories.menu_repository import MenuCategoryRepository, MenuItemRepository
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryRead,
    MenuCategoryUpdate,
    MenuItemCreate,
    MenuItemRead,
    MenuItemUpdate,
)

router = APIRouter()


@router.get("/categories")
def list_categories(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.view")),
) -> dict:
    categories = MenuCategoryRepository(db).list_ordered(hotel_id)
    return ok([MenuCategoryRead.model_validate(item).model_dump() for item in categories])


@router.post("/categories")
def create_category(
    hotel_id: str,
    payload: MenuCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.view")),
) -> dict:
    category = MenuCategory(hotel_id=hotel_id, **payload.model_dump())
    MenuCategoryRepository(db).add(category)
    return ok(MenuCategoryRead.model_validate(category).model_dump())


@router.patch("/categories/{category_id}")
def update_category(
    hotel_id: str,
    category_id: str,
    payload: MenuCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.manage")),
) -> dict:
    repo = MenuCategoryRepository(db)
    category = repo.get_for_hotel(hotel_id, category_id)
    if not category:
        from app.core.exceptions import not_found

        raise not_found("Menu category not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, field, value)
    repo.commit(category)
    return ok(MenuCategoryRead.model_validate(category).model_dump())


@router.delete("/categories/{category_id}")
def delete_category(
    hotel_id: str,
    category_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.manage")),
) -> dict:
    repo = MenuCategoryRepository(db)
    category = repo.get_for_hotel(hotel_id, category_id)
    if not category:
        from app.core.exceptions import not_found

        raise not_found("Menu category not found")
    repo.soft_delete(category, utcnow(), current_user.id)
    return ok({"deleted": True})


@router.get("/items")
def list_items(
    hotel_id: str,
    category_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.manage")),
) -> dict:
    repo = MenuItemRepository(db)
    items = repo.list_for_category_admin(hotel_id, category_id)
    return ok([_menu_item_read(repo, item).model_dump() for item in items])


@router.post("/items")
def create_item(
    hotel_id: str,
    payload: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.manage")),
) -> dict:
    repo = MenuItemRepository(db)
    data = payload.model_dump(exclude={"tax_config_ids"})
    item = MenuItem(hotel_id=hotel_id, **data)
    repo.add(item, commit=False)
    db.flush()
    repo.set_item_taxes(item.id, payload.tax_config_ids)
    repo.commit(item)
    return ok(_menu_item_read(repo, item).model_dump())


@router.patch("/items/{item_id}")
def update_item(
    hotel_id: str,
    item_id: str,
    payload: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.manage")),
) -> dict:
    repo = MenuItemRepository(db)
    item = repo.get_for_hotel(hotel_id, item_id)
    if not item:
        from app.core.exceptions import not_found

        raise not_found("Menu item not found")
    data = payload.model_dump(exclude_unset=True, exclude={"tax_config_ids"})
    for field, value in data.items():
        setattr(item, field, value)
    if payload.tax_config_ids is not None:
        repo.set_item_taxes(item.id, payload.tax_config_ids)
    repo.commit(item)
    return ok(_menu_item_read(repo, item).model_dump())


@router.delete("/items/{item_id}")
def delete_item(
    hotel_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("menu.manage")),
) -> dict:
    repo = MenuItemRepository(db)
    item = repo.get_for_hotel(hotel_id, item_id)
    if not item:
        from app.core.exceptions import not_found

        raise not_found("Menu item not found")
    repo.soft_delete(item, utcnow(), current_user.id)
    return ok({"deleted": True})


def _menu_item_read(repo: MenuItemRepository, item: MenuItem) -> MenuItemRead:
    data = MenuItemRead.model_validate(item).model_dump()
    data["tax_config_ids"] = repo.tax_ids_for_item(item.id)
    return MenuItemRead(**data)

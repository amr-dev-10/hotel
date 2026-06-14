from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.dependencies import ensure_hotel_access, get_current_user
from app.core.database import get_db
from app.core.responses import ok
from app.models.menu import MenuCategory, MenuItem
from app.models.user import User
from app.repositories.menu_repository import MenuCategoryRepository, MenuItemRepository
from app.schemas.menu import (
    MenuCategoryCreate,
    MenuCategoryRead,
    MenuItemCreate,
    MenuItemRead,
)

router = APIRouter()


@router.get("/categories")
def list_categories(
    hotel_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    categories = MenuCategoryRepository(db).list_for_hotel(hotel_id)
    return ok([MenuCategoryRead.model_validate(item).model_dump() for item in categories])


@router.post("/categories")
def create_category(
    hotel_id: str,
    payload: MenuCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    category = MenuCategory(hotel_id=hotel_id, **payload.model_dump())
    MenuCategoryRepository(db).add(category)
    return ok(MenuCategoryRead.model_validate(category).model_dump())


@router.get("/items")
def list_items(
    hotel_id: str,
    category_id: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    items = MenuItemRepository(db).list_available(hotel_id, category_id)
    return ok([MenuItemRead.model_validate(item).model_dump() for item in items])


@router.post("/items")
def create_item(
    hotel_id: str,
    payload: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    ensure_hotel_access(hotel_id, current_user)
    item = MenuItem(hotel_id=hotel_id, **payload.model_dump())
    MenuItemRepository(db).add(item)
    return ok(MenuItemRead.model_validate(item).model_dump())

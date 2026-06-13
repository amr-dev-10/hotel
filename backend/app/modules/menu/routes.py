from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.middleware.auth import TenantContext, require_tenant_context
from app.modules.hotel.dependencies import ensure_hotel_scope
from app.modules.menu.models import MenuCategory, MenuItem
from app.modules.menu.schemas import (
    MenuCategoryCreate,
    MenuCategoryRead,
    MenuCategoryUpdate,
    MenuItemCreate,
    MenuItemRead,
    MenuItemUpdate,
)

router = APIRouter(prefix="/hotels/{hotel_id}/menu", tags=["menu"])


def _category_to_read(category: MenuCategory) -> MenuCategoryRead:
    return MenuCategoryRead(
        id=category.id,
        hotel_id=category.tenant_id,
        name=category.name,
        type=category.type,
        display_order=category.display_order,
        is_active=category.is_active,
    )


def _item_to_read(item: MenuItem) -> MenuItemRead:
    return MenuItemRead(
        id=item.id,
        hotel_id=item.tenant_id,
        category_id=item.category_id,
        name=item.name,
        price=item.price,
        description=item.description,
        image_url=item.image_url,
        is_available=item.is_available,
        display_order=item.display_order,
    )


def _get_category(db: Session, hotel_id: str, category_id: str) -> MenuCategory:
    category = db.scalar(select(MenuCategory).where(MenuCategory.tenant_id == hotel_id, MenuCategory.id == category_id))
    if category is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu category not found")
    return category


def _get_item(db: Session, hotel_id: str, item_id: str) -> MenuItem:
    item = db.scalar(select(MenuItem).where(MenuItem.tenant_id == hotel_id, MenuItem.id == item_id))
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Menu item not found")
    return item


@router.get("/categories", response_model=list[MenuCategoryRead])
def list_categories(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[MenuCategoryRead]:
    ensure_hotel_scope(hotel_id, context)
    categories = db.scalars(
        select(MenuCategory).where(MenuCategory.tenant_id == hotel_id).order_by(MenuCategory.display_order, MenuCategory.name)
    ).all()
    return [_category_to_read(category) for category in categories]


@router.post("/categories", response_model=MenuCategoryRead, status_code=201)
def create_category(
    hotel_id: str,
    payload: MenuCategoryCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> MenuCategoryRead:
    ensure_hotel_scope(hotel_id, context)
    category = MenuCategory(tenant_id=hotel_id, **payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return _category_to_read(category)


@router.put("/categories/{cat_id}", response_model=MenuCategoryRead)
def update_category(
    hotel_id: str,
    cat_id: str,
    payload: MenuCategoryUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> MenuCategoryRead:
    ensure_hotel_scope(hotel_id, context)
    category = _get_category(db, hotel_id, cat_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    db.commit()
    db.refresh(category)
    return _category_to_read(category)


@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(
    hotel_id: str,
    cat_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Response:
    ensure_hotel_scope(hotel_id, context)
    category = _get_category(db, hotel_id, cat_id)
    category.is_active = False
    db.commit()
    return Response(status_code=204)


@router.get("/items", response_model=list[MenuItemRead])
def list_items(
    hotel_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> list[MenuItemRead]:
    ensure_hotel_scope(hotel_id, context)
    items = db.scalars(select(MenuItem).where(MenuItem.tenant_id == hotel_id).order_by(MenuItem.display_order, MenuItem.name)).all()
    return [_item_to_read(item) for item in items]


@router.post("/categories/{cat_id}/items", response_model=MenuItemRead, status_code=201)
def create_item(
    hotel_id: str,
    cat_id: str,
    payload: MenuItemCreate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> MenuItemRead:
    ensure_hotel_scope(hotel_id, context)
    _get_category(db, hotel_id, cat_id)
    item = MenuItem(tenant_id=hotel_id, category_id=cat_id, **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_to_read(item)


@router.put("/items/{item_id}", response_model=MenuItemRead)
def update_item(
    hotel_id: str,
    item_id: str,
    payload: MenuItemUpdate,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> MenuItemRead:
    ensure_hotel_scope(hotel_id, context)
    item = _get_item(db, hotel_id, item_id)
    updates = payload.model_dump(exclude_unset=True)
    if "category_id" in updates:
        _get_category(db, hotel_id, updates["category_id"])
    for key, value in updates.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return _item_to_read(item)


@router.delete("/items/{item_id}", status_code=204)
def delete_item(
    hotel_id: str,
    item_id: str,
    context: TenantContext = Depends(require_tenant_context),
    db: Session = Depends(get_db),
) -> Response:
    ensure_hotel_scope(hotel_id, context)
    item = _get_item(db, hotel_id, item_id)
    db.delete(item)
    db.commit()
    return Response(status_code=204)

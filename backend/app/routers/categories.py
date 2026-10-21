from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Category, ItemType, ItemTypeCategory, SizeOption
from app.schemas import CategoryRead, ItemTypeRead, SizeOptionRead


router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    categories = db.execute(select(Category).order_by(Category.id)).scalars().all()
    return categories


@router.get("/{category_code}/item-types", response_model=list[ItemTypeRead])
def list_item_types(category_code: str, db: Session = Depends(get_db)):
    category = db.execute(
        select(Category).where(Category.code == category_code)
    ).scalar_one_or_none()

    if not category:
        raise HTTPException(status_code=404, detail="Категория не найдена")

    rows = db.execute(
        select(ItemType, ItemTypeCategory.is_required)
        .join(ItemTypeCategory, ItemTypeCategory.item_type_id == ItemType.id)
        .where(ItemTypeCategory.category_id == category.id)
        .options(selectinload(ItemType.size_options))
        .order_by(ItemType.id)
    ).all()

    result = []
    for item_type, is_required in rows:
        size_options = sorted(item_type.size_options, key=lambda s: s.id)
        result.append(
            ItemTypeRead(
                id=item_type.id,
                code=item_type.code,
                name=item_type.name,
                is_required=is_required,
                size_options=[SizeOptionRead.model_validate(s) for s in size_options],
            )
        )
    return result

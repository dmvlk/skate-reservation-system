from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ItemTypeCategory(Base):
    __tablename__ = "item_type_categories"

    item_type_id: Mapped[int] = mapped_column(
        ForeignKey("item_types.id", ondelete="CASCADE"), primary_key=True
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

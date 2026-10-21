from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemType(Base):
    __tablename__ = "item_types"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    categories: Mapped[list["Category"]] = relationship(
        secondary="item_type_categories",
        back_populates="item_types",
    )
    size_options: Mapped[list["SizeOption"]] = relationship(back_populates="item_type")
    inventory_items: Mapped[list["InventoryItem"]] = relationship(back_populates="item_type")

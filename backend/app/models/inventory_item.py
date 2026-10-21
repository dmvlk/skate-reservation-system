from sqlalchemy import ForeignKey, ForeignKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        ForeignKeyConstraint(
            ["size_option_id", "item_type_id"],
            ["size_options.id", "size_options.item_type_id"],
            name="fk_inventory_item_size_option",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_type_id: Mapped[int] = mapped_column(ForeignKey("item_types.id"), nullable=False)
    size_option_id: Mapped[int | None] = mapped_column(nullable=True)
    status_id: Mapped[int] = mapped_column(ForeignKey("item_statuses.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    size_value: Mapped[int | None] = mapped_column(nullable=True)

    item_type: Mapped["ItemType"] = relationship(back_populates="inventory_items")
    size_option: Mapped["SizeOption | None"] = relationship(back_populates="inventory_items")
    status: Mapped["ItemStatus"] = relationship(back_populates="inventory_items")
    booking_items: Mapped[list["BookingItem"]] = relationship(back_populates="inventory_item")

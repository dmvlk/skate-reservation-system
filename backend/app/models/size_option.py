from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SizeOption(Base):
    __tablename__ = "size_options"
    __table_args__ = (
        UniqueConstraint("item_type_id", "code", name="uq_size_option_type_code"),
        UniqueConstraint("id", "item_type_id", name="uq_size_option_id_type"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    item_type_id: Mapped[int] = mapped_column(
        ForeignKey("item_types.id", ondelete="CASCADE"), nullable=False
    )
    code: Mapped[str] = mapped_column(String(10), nullable=False)

    item_type: Mapped["ItemType"] = relationship(back_populates="size_options")
    inventory_items: Mapped[list["InventoryItem"]] = relationship(back_populates="size_option")

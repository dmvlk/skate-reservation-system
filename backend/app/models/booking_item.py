from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BookingItem(Base):
    __tablename__ = "booking_items"
    __table_args__ = (
        UniqueConstraint("booking_id", "inventory_item_id", name="uq_booking_item"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    inventory_item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="items")
    inventory_item: Mapped["InventoryItem"] = relationship(back_populates="booking_items")

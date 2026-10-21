from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ItemStatus(Base):
    __tablename__ = "item_statuses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    inventory_items: Mapped[list["InventoryItem"]] = relationship(back_populates="status")


class BookingStatus(Base):
    __tablename__ = "booking_statuses"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    bookings: Mapped[list["Booking"]] = relationship(back_populates="status")

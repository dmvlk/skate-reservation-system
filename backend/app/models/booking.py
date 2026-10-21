from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False)
    status_id: Mapped[int] = mapped_column(ForeignKey("booking_statuses.id"), nullable=False)
    issued_by: Mapped[int | None] = mapped_column(ForeignKey("admins.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    client: Mapped["Client"] = relationship(back_populates="bookings")
    status: Mapped["BookingStatus"] = relationship(back_populates="bookings")
    issued_by_admin: Mapped["Admin | None"] = relationship(back_populates="issued_bookings")
    slots: Mapped[list["BookingSlot"]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    items: Mapped[list["BookingItem"]] = relationship(back_populates="booking", cascade="all, delete-orphan")

from datetime import date

from sqlalchemy import Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BookingSlot(Base):
    __tablename__ = "booking_slots"
    __table_args__ = (
        UniqueConstraint("booking_id", "booking_date", "hour", name="uq_booking_slot"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False)
    booking_date: Mapped[date] = mapped_column(Date, nullable=False)
    hour: Mapped[int] = mapped_column(nullable=False)

    booking: Mapped["Booking"] = relationship(back_populates="slots")

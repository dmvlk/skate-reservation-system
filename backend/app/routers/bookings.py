from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.booking import BookingCreate, BookingRead
from app.services.booking import create_booking


router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post(
    "", 
    response_model=BookingRead, 
    status_code=201,
    summary="Создать бронь",
    description="Создаёт новую бронь. Проверяет доступность инвентаря и защищает от одновременного бронирования (race condition)."
)
def book(payload: BookingCreate, db: Session = Depends(get_db)):
    try:
        booking = create_booking(db, payload)
        db.commit()
        db.refresh(booking)

        client = booking.client
        last4 = client.phone[-4:] if len(client.phone) >= 4 else client.phone

        slots = sorted(booking.slots, key=lambda s: s.hour)

        return BookingRead(
            id=booking.id,
            phone_last4=last4,
            category=payload.category,
            booking_date=slots[0].booking_date if slots else payload.booking_date,
            hours=[s.hour for s in slots],
            status=booking.status.code,
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Ошибка создания брони: {e}")

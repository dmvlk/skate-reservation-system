from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.my_bookings import (
    CancelResponse,
    ExtendRequest,
    ExtensionOptions,
    MyBookingItem,
    MyBookingRead,
)
from app.services.booking import (
    cancel_booking,
    extend_booking,
    get_bookings_by_phone,
    get_extension_options,
)


router = APIRouter(prefix="/my-bookings", tags=["my-bookings"])


@router.get(
    "", 
    response_model=list[MyBookingRead],
    summary="Мои брони",
    description="Возвращает список всех броней клиента по номеру телефона."
)
def list_my_bookings(
    phone: str = Query(..., description="Номер телефона клиента", examples=["+79161234567"]),
    db: Session = Depends(get_db),
):

    bookings = get_bookings_by_phone(db, phone)
    
    result = []
    for b in bookings:
        category_code = ""
        items_info = []
        
        for b_item in b.items:
            item = b_item.inventory_item
            item_type = item.item_type
            
            size_str = None

            if item.size_value is not None:
                size_str = str(item.size_value)
            elif item.size_option is not None:
                size_str = item.size_option.code
            
            items_info.append(
                MyBookingItem(
                    item_type=item_type.name,
                    size=size_str,
                )
            )
            
            # Категория: первая, которая найдётся среди категорий типа
            if not category_code and item_type.categories:
                category_code = item_type.categories[0].code
        
        hours = sorted([s.hour for s in b.slots])
        booking_date = b.slots[0].booking_date if b.slots else None
        
        result.append(
            MyBookingRead(
                id=b.id,
                category=category_code,
                booking_date=booking_date,
                hours=hours,
                status=b.status.code,
                items=items_info,
            )
        )
    
    return result


@router.post(
    "/{booking_id}/cancel", 
    response_model=CancelResponse,
    summary="Отменить бронь",
    description="Отменяет бронь клиента. Требуется указать номер телефона, чтобы чужую бронь нельзя было отменить."
)
def cancel(
    booking_id: int,
    phone: str = Query(..., description="Номер телефона клиента", examples=["+79161234567"]),
    db: Session = Depends(get_db),
):

    try:
        booking = cancel_booking(db, booking_id, phone)
        db.commit()
        db.refresh(booking)
        
        return CancelResponse(
            id=booking.id,
            status=booking.status.code,
            message="Бронь успешно отменена",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Ошибка отмены: {e}")


@router.get(
    "/{booking_id}/extension-options", 
    response_model=ExtensionOptions,
    summary="Варианты продления",
    description="Возвращает часы, на которые можно продлить бронь (подряд после последнего часа)."
)
def extension_options(
    booking_id: int,
    phone: str = Query(..., description="Номер телефона клиента", examples=["+79161234567"]),
    db: Session = Depends(get_db),
):
    return get_extension_options(db, booking_id, phone)


@router.post(
    "/{booking_id}/extend",
    summary="Продлить бронь",
    description="Продлевает бронь на указанные часы (только подряд после последнего часа)."
)
def extend(
    booking_id: int,
    payload: ExtendRequest,
    phone: str = Query(..., description="Номер телефона клиента", examples=["+79161234567"]),
    db: Session = Depends(get_db),
):
    try:
        booking = extend_booking(db, booking_id, phone, payload.hours_to_add)
        db.commit()
        db.refresh(booking)

        hours = sorted([s.hour for s in booking.slots])
        return {
            "id": booking.id,
            "status": booking.status.code,
            "hours": hours,
            "message": f"Бронь продлена до {max(hours) + 1}:00",
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Ошибка продления: {e}")

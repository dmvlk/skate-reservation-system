from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Admin
from app.routers.deps import get_current_admin
from app.schemas.admin import (
    AdminBookingRead,
    CompleteBookingResponse,
    InventoryItemCreate,
    InventoryItemRead,
    InventoryItemStatusUpdate,
    IssueBookingResponse,
)
from app.services import admin as admin_service


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get(
    "/inventory", 
    response_model=list[InventoryItemRead],
    summary="Список инвентаря",
    description="Возвращает список единиц инвентаря с возможностью фильтрации по типу и статусу."
)
def list_inventory(
    item_type: str | None = Query(None, description="Код типа (например, skate)", examples=["skate"]),
    status: str | None = Query(None, description="Статус инвентаря", examples=["available"]),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    return admin_service.list_inventory(db, item_type, status)


@router.post(
    "/inventory", 
    response_model=InventoryItemRead, 
    status_code=201,
    summary="Добавить инвентарь",
    description="Добавляет новую единицу инвентаря. Если размер буквенный, передается `size_bucket`, если числовой — `size_value`."
)
def add_inventory(
    payload: InventoryItemCreate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        item = admin_service.add_inventory_item(
            db, payload.item_type_code, payload.size_value, payload.size_bucket
        )
        db.commit()
        db.refresh(item)
        return InventoryItemRead(
            id=item.id,
            item_type=item.item_type.name,
            size=str(item.size_value) if item.size_value is not None else (
                item.size_option.code if item.size_option else None
            ),
            status=item.status.code,
            code=item.code,
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.delete(
    "/inventory/{item_id}", 
    status_code=204,
    summary="Удалить инвентарь",
    description="Удаляет единицу инвентаря. Нельзя удалить, если она участвует в брони."
)
def delete_inventory(
    item_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        admin_service.delete_inventory_item(db, item_id)
        db.commit()
        return None
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.patch(
    "/inventory/{item_id}/status", 
    response_model=InventoryItemRead,
    summary="Сменить статус инвентаря",
    description="Меняет статус единицы (например, пометить как сломанную)."
)
def update_inventory_status(
    item_id: int,
    payload: InventoryItemStatusUpdate,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        item = admin_service.update_inventory_status(db, item_id, payload.status_code)
        db.commit()
        db.refresh(item)
        return InventoryItemRead(
            id=item.id,
            item_type=item.item_type.name,
            size=str(item.size_value) if item.size_value is not None else (
                item.size_option.code if item.size_option else None
            ),
            status=item.status.code,
            code=item.code,
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.get(
    "/bookings", 
    response_model=list[AdminBookingRead],
    summary="Найти брони по телефону",
    description="Ищет все брони клиента по номеру телефона."
)
def find_bookings(
    phone: str = Query(..., description="Номер телефона клиента", examples=["+79161234567"]),
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    bookings = admin_service.find_booking_by_phone(db, phone)

    result = []
    for b in bookings:
        hours = sorted([s.hour for s in b.slots])
        booking_date = b.slots[0].booking_date if b.slots else None

        item_names = []
        category = ""
        for bi in b.items:
            inv = bi.inventory_item
            item_names.append(inv.item_type.name)
            if not category and inv.item_type.categories:
                category = inv.item_type.categories[0].code

        parts = [b.client.last_name, b.client.first_name, b.client.middle_name]
        full_name = " ".join(p for p in parts if p)

        result.append(
            AdminBookingRead(
                id=b.id,
                phone=b.client.phone,
                full_name=full_name,
                category=category,
                booking_date=booking_date,
                hours=hours,
                status=b.status.code,
                items=item_names,
            )
        )
    return result


@router.post(
    "/bookings/{booking_id}/issue", 
    response_model=IssueBookingResponse,
    summary="Выдать инвентарь",
    description="Меняет статус брони на `issued` и помечает инвентарь как выданный."
)
def issue_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        booking = admin_service.issue_booking(db, booking_id, admin.id)
        db.commit()
        db.refresh(booking)

        parts = [admin.last_name, admin.first_name, admin.middle_name]
        full_name = " ".join(p for p in parts if p)

        return IssueBookingResponse(
            id=booking.id,
            status=booking.status.code,
            issued_by=full_name,
            message="Инвентарь выдан",
        )

    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.post(
    "/bookings/{booking_id}/complete", 
    response_model=CompleteBookingResponse,
    summary="Принять возврат",
    description="Меняет статус брони на `completed` и возвращает инвентарь в доступные."
)
def complete_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):
    try:
        booking = admin_service.complete_booking(db, booking_id)
        db.commit()
        db.refresh(booking)

        return CompleteBookingResponse(
            id=booking.id,
            status=booking.status.code,
            message="Возврат принят",
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))


@router.get(
    "/bookings/{booking_id}", 
    response_model=AdminBookingRead,
    summary="Бронь по ID (для QR кода)",
    description="Возвращает данные брони по ID. Используется для сканирования QR-кода."
)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    admin: Admin = Depends(get_current_admin),
):

    booking = admin_service.get_booking_by_id(db, booking_id)
    if not booking:
        raise HTTPException(404, "Бронь не найдена")

    hours = sorted([s.hour for s in booking.slots])
    booking_date = booking.slots[0].booking_date if booking.slots else None

    item_names = []
    category = ""
    for bi in booking.items:
        inv = bi.inventory_item
        item_names.append(inv.item_type.name)
        if not category and inv.item_type.categories:
            category = inv.item_type.categories[0].code

    parts = [booking.client.last_name, booking.client.first_name, booking.client.middle_name]
    full_name = " ".join(p for p in parts if p)

    return AdminBookingRead(
        id=booking.id,
        phone=booking.client.phone,
        full_name=full_name,
        category=category,
        booking_date=booking_date,
        hours=hours,
        status=booking.status.code,
        items=item_names,
    )
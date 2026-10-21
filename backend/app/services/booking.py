from fastapi import HTTPException
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from datetime import date, datetime

from app.models import (
    Booking,
    BookingItem,
    BookingSlot,
    BookingStatus,
    Category,
    Client,
    InventoryItem,
    ItemStatus,
    ItemType,
    SizeOption,
)
from app.schemas.booking import BookingCreate


WORK_HOURS = set(range(10, 20))


def _normalize_phone(phone: str) -> str:
    digits = "".join(c for c in phone if c.isdigit())
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    return digits


def _get_type(db: Session, code: str) -> ItemType:
    t = db.execute(select(ItemType).where(ItemType.code == code)).scalar_one_or_none()
    if not t:
        raise HTTPException(500, f"Тип {code} не найден в справочнике")
    return t


def create_booking(db: Session, payload: BookingCreate) -> Booking:
    if not payload.hours:
        raise HTTPException(400, "Нужно выбрать хотя бы один час")

    if any(h not in WORK_HOURS for h in payload.hours):
        raise HTTPException(400, "Часы должны быть в доступном диапазоне")

    if len(set(payload.hours)) != len(payload.hours):
        raise HTTPException(400, "Часы не могут повторяться")

    now = datetime.now()
    today = date.today()

    if payload.booking_date < today:
        raise HTTPException(400, "Нельзя бронировать на прошедшую дату")

    if payload.booking_date == today:
        current_hour = now.hour
        if any(h <= current_hour for h in payload.hours):
            raise HTTPException(
                400,
                "Нельзя бронировать на прошедшие часы."
            )

    category = db.execute(
        select(Category).where(Category.code == payload.category)
    ).scalar_one_or_none()
    if not category:
        raise HTTPException(404, "Категория не найдена")

    if payload.category == "skates":
        if payload.size_value is None:
            raise HTTPException(400, "Для коньков нужен size_value")
        required_types = [("skate", payload.size_value, None)]
    elif payload.category in ("skis", "snowboard"):
        if not payload.size_bucket or not payload.boot_size_value:
            raise HTTPException(400, "Для лыж/сноуборда нужны size_bucket и boot_size_value")
        board_code = "ski" if payload.category == "skis" else "snowboard"
        boot_code = "ski_boot" if payload.category == "skis" else "snowboard_boot"
        required_types = [
            (board_code, None, payload.size_bucket),
            (boot_code, payload.boot_size_value, None),
        ]
    else:
        raise HTTPException(400, "Неизвестная категория")



    active_status = db.execute(
        select(BookingStatus).where(BookingStatus.code == "active")
    ).scalar_one()
    available_status = db.execute(
        select(ItemStatus).where(ItemStatus.code == "available")
    ).scalar_one()

    issued_status = db.execute(
        select(BookingStatus).where(BookingStatus.code == "issued")
    ).scalar_one()

    busy_rows = db.execute(
        select(BookingSlot.hour, BookingItem.inventory_item_id)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .join(BookingItem, BookingItem.booking_id == Booking.id)
        .where(
            BookingSlot.booking_date == payload.booking_date,
            Booking.status_id.in_([
                active_status.id,
                issued_status.id,
            ]),
        )
    ).all()

    busy_per_hour: dict[int, set[int]] = {}
    for h, item_id in busy_rows:
        busy_per_hour.setdefault(h, set()).add(item_id)

    selected_items: list[InventoryItem] = []

    for type_code, size_value, size_bucket in required_types:
        item_type = _get_type(db, type_code)

        stmt = select(InventoryItem).where(
            InventoryItem.item_type_id == item_type.id,
            InventoryItem.status_id == available_status.id,
        )
        if size_value is not None:
            stmt = stmt.where(InventoryItem.size_value == size_value)
        if size_bucket is not None:
            stmt = stmt.join(SizeOption, SizeOption.id == InventoryItem.size_option_id).where(
                SizeOption.code == size_bucket
            )
        stmt = stmt.with_for_update(skip_locked=True).order_by(InventoryItem.id)

        candidates = db.execute(stmt).scalars().all()

        chosen = None
        for item in candidates:
            free = all(item.id not in busy_per_hour.get(h, set()) for h in payload.hours)
            if free:
                chosen = item
                break

        if not chosen:
            raise HTTPException(
                409,
                f"На выбранные часы нет свободной единицы: {item_type.name} "
                f"(размер: {size_value or size_bucket})"
            )

        selected_items.append(chosen)

    normalized_phone = _normalize_phone(payload.phone)
    client = db.execute(
        select(Client).where(Client.phone == normalized_phone)
    ).scalar_one_or_none()

    if client is None:
        client = Client(
            phone=normalized_phone,
            last_name=payload.last_name.strip(),
            first_name=payload.first_name.strip(),
            middle_name=(payload.middle_name or "").strip() or None,
        )
        db.add(client)
        db.flush()

    # Проверка лимита броинрований
    active_count = db.execute(
        select(func.count())
        .select_from(Booking)
        .where(
            Booking.client_id == client.id,
            Booking.status_id == active_status.id,
        )
    ).scalar_one()

    if active_count >= 4:
        raise HTTPException(
            429,
            "У вас уже 4 активные брони. Отмените одну, чтобы создать новую."
        )

    booking = Booking(
        client_id=client.id,
        status_id=active_status.id,
    )
    db.add(booking)
    db.flush()

    for h in sorted(payload.hours):
        db.add(
            BookingSlot(
                booking_id=booking.id,
                booking_date=payload.booking_date,
                hour=h,
            )
        )

    for item in selected_items:
        db.add(
            BookingItem(
                booking_id=booking.id,
                inventory_item_id=item.id,
            )
        )

    db.flush()
    return booking

def get_bookings_by_phone(db: Session, phone: str) -> list[Booking]:
    #возвращает все брони клиента по номеру телефона
    normalized = _normalize_phone(phone)
    client = db.execute(
        select(Client).where(Client.phone == normalized)
    ).scalar_one_or_none()

    if not client:
        return []

    bookings = db.execute(
        select(Booking)
        .where(Booking.client_id == client.id)
        .order_by(Booking.created_at.desc())
    ).scalars().all()
    return list(bookings)


def cancel_booking(db: Session, booking_id: int, phone: str) -> Booking:
    normalized = _normalize_phone(phone)
    
    booking = db.execute(
        select(Booking).where(Booking.id == booking_id)
    ).scalar_one_or_none()
    
    if not booking:
        raise HTTPException(404, "Бронь не найдена")

    if booking.client.phone != normalized:
        raise HTTPException(404, "Бронь не найдена")  
    
    active_status = db.execute(
        select(BookingStatus).where(BookingStatus.code == "active")
    ).scalar_one()
    
    if booking.status_id != active_status.id:
        raise HTTPException(400, f"Нельзя отменить бронь в статусе «{booking.status.code}»")
    
    cancelled_status = db.execute(
        select(BookingStatus).where(BookingStatus.code == "cancelled")
    ).scalar_one()
    
    booking.status_id = cancelled_status.id
    db.flush()
    return booking

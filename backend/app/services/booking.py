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
    ItemTypeCategory,
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

    extra_items: dict[str, tuple[int | None, str | None]] = {}
    for item in payload.selected_items:
        extra_items[item.item_type_code] = (item.size_value, item.size_bucket)

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

    required_from_db = db.execute(
        select(ItemType.code)
        .join(ItemTypeCategory, ItemTypeCategory.item_type_id == ItemType.id)
        .where(
            ItemTypeCategory.category_id == category.id,
            ItemTypeCategory.is_required == True,
        )
    ).scalars().all()

    base_codes = {t[0] for t in required_types}
    for req_code in required_from_db:
        if req_code in base_codes:
            continue
        if req_code not in extra_items:
            raise HTTPException(
                400,
                f"Для категории «{category.name}» обязательно выбрать: {req_code}"
            )

    all_required: list[tuple[str, int | None, str | None]] = list(required_types)
    for code, (sv, sb) in extra_items.items():
        all_required.append((code, sv, sb))

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

    for type_code, size_value, size_bucket in all_required:
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

                f"(размер: {size_value or size_bucket or 'без размера'})"
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


def get_extension_options(db: Session, booking_id: int, phone: str) -> dict:

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
        raise HTTPException(400, "Продлить можно только активную бронь")

    current_hours = sorted([s.hour for s in booking.slots])
    if not current_hours:
        return {"booking_id": booking.id, "current_hours": [], "available_extension_hours": []}

    last_hour = max(current_hours)
    booking_date = booking.slots[0].booking_date

    base_codes = ["skate", "ski", "snowboard", "ski_boot", "snowboard_boot"]
    base_item_ids = [
        bi.inventory_item_id 
        for bi in booking.items 
        if bi.inventory_item.item_type.code in base_codes
    ]

    busy_statuses = db.execute(
        select(BookingStatus).where(BookingStatus.code.in_(["active", "issued"]))
    ).scalars().all()
    busy_status_ids = [s.id for s in busy_statuses]

    other_busy_rows = db.execute(
        select(BookingSlot.hour)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .join(BookingItem, BookingItem.booking_id == Booking.id)
        .where(
            BookingSlot.booking_date == booking_date,
            Booking.id != booking.id,
            Booking.status_id.in_(busy_status_ids),
            BookingItem.inventory_item_id.in_(base_item_ids),
        )
    ).all()
    busy_hours_other = {row[0] for row in other_busy_rows}

    available: list[int] = []
    h = last_hour + 1
    while h < 20:
        if h in busy_hours_other:
            break
        available.append(h)
        h += 1

    return {
        "booking_id": booking.id,
        "current_hours": current_hours,
        "available_extension_hours": available,
    }


def extend_booking(
    db: Session, booking_id: int, phone: str, hours_to_add: list[int]
) -> Booking:

    if not hours_to_add:
        raise HTTPException(400, "Нужно указать хотя бы один час")

    if any(h not in WORK_HOURS for h in hours_to_add):
        raise HTTPException(400, "Часы должны быть в доступном диапазоне")

    if len(set(hours_to_add)) != len(hours_to_add):
        raise HTTPException(400, "Часы не могут повторяться")

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
        raise HTTPException(400, "Продлить можно только активную бронь")

    current_hours = sorted([s.hour for s in booking.slots])
    if not current_hours:
        raise HTTPException(400, "У брони нет часов")

    last_hour = max(current_hours)
    booking_date = booking.slots[0].booking_date

    expected = list(range(last_hour + 1, last_hour + 1 + len(hours_to_add)))
    if sorted(hours_to_add) != expected:
        raise HTTPException(
            400,
            f"Продление возможно только на следующий час после {last_hour}:00. "
        )

    base_codes = ["skate", "ski", "snowboard", "ski_boot", "snowboard_boot"]
    base_item_ids = [
        bi.inventory_item_id 
        for bi in booking.items 
        if bi.inventory_item.item_type.code in base_codes
    ]

    if not base_item_ids:
        raise HTTPException(400, "В брони нет базового снаряжения")

    busy_statuses = db.execute(
        select(BookingStatus).where(
            BookingStatus.code.in_(["active", "issued"])
        )
    ).scalars().all()
    busy_status_ids = [s.id for s in busy_statuses]

    conflict = db.execute(
        select(BookingSlot.hour)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .join(BookingItem, BookingItem.booking_id == Booking.id)
        .where(
            BookingSlot.booking_date == booking_date,
            Booking.id != booking.id,
            Booking.status_id.in_(busy_status_ids),
            BookingItem.inventory_item_id.in_(base_item_ids), # Проверяем только базовые вещи
            BookingSlot.hour.in_(hours_to_add),
        )
        .limit(1)
    ).scalar_one_or_none()

    if conflict is not None:
        raise HTTPException(
            409,
            f"Час {conflict}:00 уже занят другой бронью. Продление невозможно."
        )

    for h in sorted(hours_to_add):
        db.add(
            BookingSlot(
                booking_id=booking.id,
                booking_date=booking_date,
                hour=h,
            )
        )

    db.flush()
    return booking

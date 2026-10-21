from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.models import (
    Booking,
    BookingItem,
    BookingStatus,
    Client,
    InventoryItem,
    ItemStatus,
    ItemType,
    SizeOption,
)


def list_inventory(
    db: Session,
    item_type_code: str | None = None,
    status_code: str | None = None,
) -> list[dict]:
    stmt = (
        select(InventoryItem)
        .options(
            selectinload(InventoryItem.item_type),
            selectinload(InventoryItem.size_option),
            selectinload(InventoryItem.status),
        )
        .order_by(InventoryItem.id)
    )

    if item_type_code:
        stmt = stmt.join(ItemType).where(ItemType.code == item_type_code)
    if status_code:
        stmt = stmt.join(ItemStatus).where(ItemStatus.code == status_code)

    items = db.execute(stmt).scalars().all()

    result = []
    for item in items:
        size = None
        if item.size_value is not None:
            size = str(item.size_value)
        elif item.size_option is not None:
            size = item.size_option.code

        result.append(
            {
                "id": item.id,
                "item_type": item.item_type.name,
                "size": size,
                "status": item.status.code,
                "code": item.code,
            }
        )
    return result


def add_inventory_item(
    db: Session,
    item_type_code: str,
    size_value: int | None,
    size_bucket: str | None,
) -> InventoryItem:
    item_type = db.execute(
        select(ItemType).where(ItemType.code == item_type_code)
    ).scalar_one_or_none()

    if not item_type:
        raise ValueError(f"Тип {item_type_code!r} не найден")

    available = db.execute(
        select(ItemStatus).where(ItemStatus.code == "available")
    ).scalar_one()

    size_option_id = None
    if size_bucket:
        so = db.execute(
            select(SizeOption).where(
                SizeOption.item_type_id == item_type.id,
                SizeOption.code == size_bucket,
            )
        ).scalar_one_or_none()
        if not so:
            raise ValueError(f"Размер {size_bucket!r} не подходит для типа {item_type_code!r}")
        size_option_id = so.id

    prefix = item_type_code.upper().replace("_", "")[:6]
    count = db.execute(
        select(InventoryItem).where(InventoryItem.item_type_id == item_type.id)
    ).scalars().all()
    next_num = len(count) + 1
    code = f"{prefix}-{next_num:03d}"
    while db.execute(
        select(InventoryItem).where(InventoryItem.code == code)
    ).scalar_one_or_none():
        next_num += 1
        code = f"{prefix}-{next_num:03d}"

    item = InventoryItem(
        item_type_id=item_type.id,
        size_option_id=size_option_id,
        status_id=available.id,
        code=code,
        size_value=size_value,
    )
    db.add(item)
    db.flush()
    return item


def delete_inventory_item(db: Session, item_id: int) -> None:
    item = db.execute(
        select(InventoryItem).where(InventoryItem.id == item_id)
    ).scalar_one_or_none()

    if not item:
        raise ValueError("Единица инвентаря не найдена")

    busy = db.execute(
        select(BookingItem).where(BookingItem.inventory_item_id == item_id)
    ).scalars().all()

    if busy:
        raise ValueError("Нельзя удалить: единица используется в бронях")

    db.delete(item)
    db.flush()


def update_inventory_status(
    db: Session, item_id: int, status_code: str
) -> InventoryItem:
    item = db.execute(
        select(InventoryItem).where(InventoryItem.id == item_id)
    ).scalar_one_or_none()

    if not item:
        raise ValueError("Единица инвентаря не найдена")

    status = db.execute(
        select(ItemStatus).where(ItemStatus.code == status_code)
    ).scalar_one_or_none()

    if not status:
        raise ValueError(f"Статус {status_code!r} не найден")

    item.status_id = status.id
    db.flush()
    return item


def find_booking_by_phone(db: Session, phone: str) -> list[Booking]:
    from app.services.booking import _normalize_phone

    normalized = _normalize_phone(phone)
    client = db.execute(
        select(Client).where(Client.phone == normalized)
    ).scalar_one_or_none()

    if not client:
        return []

    bookings = db.execute(
        select(Booking)
        .where(Booking.client_id == client.id)
        .options(
            selectinload(Booking.slots),
            selectinload(Booking.items).selectinload(BookingItem.inventory_item).selectinload(InventoryItem.item_type),
            selectinload(Booking.status),
            selectinload(Booking.client),
        )
        .order_by(Booking.created_at.desc())
    ).scalars().all()

    return list(bookings)


def issue_booking(db: Session, booking_id: int, admin_id: int) -> Booking:
    booking = db.execute(
        select(Booking).where(Booking.id == booking_id)
    ).scalar_one_or_none()

    if not booking:
        raise ValueError("Бронь не найдена")

    active = db.execute(
        select(BookingStatus).where(BookingStatus.code == "active")
    ).scalar_one()
    issued = db.execute(
        select(BookingStatus).where(BookingStatus.code == "issued")
    ).scalar_one()
    rented = db.execute(
        select(ItemStatus).where(ItemStatus.code == "rented")
    ).scalar_one()

    if booking.status_id != active.id:
        raise ValueError(
            f"Нельзя выдать бронь в статусе «{booking.status.code}»"
        )

    booking.status_id = issued.id
    booking.issued_by = admin_id

    for b_item in booking.items:
        b_item.inventory_item.status_id = rented.id

    db.flush()
    return booking


def complete_booking(db: Session, booking_id: int) -> Booking:
    booking = db.execute(
        select(Booking).where(Booking.id == booking_id)
    ).scalar_one_or_none()

    if not booking:
        raise ValueError("Бронь не найдена")

    issued = db.execute(
        select(BookingStatus).where(BookingStatus.code == "issued")
    ).scalar_one()
    completed = db.execute(
        select(BookingStatus).where(BookingStatus.code == "completed")
    ).scalar_one()
    available = db.execute(
        select(ItemStatus).where(ItemStatus.code == "available")
    ).scalar_one()

    if booking.status_id != issued.id:
        raise ValueError(
            f"Нельзя завершить бронь в статусе «{booking.status.code}»"
        )

    booking.status_id = completed.id

    for b_item in booking.items:
        b_item.inventory_item.status_id = available.id

    db.flush()
    return booking

def get_booking_by_id(db: Session, booking_id: int) -> Booking | None:
    return db.execute(
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            selectinload(Booking.slots),
            selectinload(Booking.items)
                .selectinload(BookingItem.inventory_item)
                .selectinload(InventoryItem.item_type)
                .selectinload(ItemType.categories),
            selectinload(Booking.status),
            selectinload(Booking.client),
        )
    ).scalar_one_or_none()

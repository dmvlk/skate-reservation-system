from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    Booking,
    BookingItem,
    BookingSlot,
    BookingStatus,
    Category,
    InventoryItem,
    ItemStatus,
    ItemType,
    ItemTypeCategory,
    SizeOption,
)

# Рабочие часы 10:00-20:00
WORK_START_HOUR = 10
WORK_END_HOUR = 20
HOURS_RANGE = list(range(WORK_START_HOUR, WORK_END_HOUR))


def _available_status_id(db: Session) -> int:
    st = db.execute(
        select(ItemStatus).where(ItemStatus.code == "available")
    ).scalar_one()
    return st.id


def _get_category(db: Session, category_code: str) -> Category:
    cat = db.execute(
        select(Category).where(Category.code == category_code)
    ).scalar_one_or_none()
    if not cat:
        raise ValueError(f"Категория {category_code!r} не найдена")
    return cat


def _busy_booking_status_ids(db: Session) -> list[int]:
    statuses = db.execute(
        select(BookingStatus).where(
            BookingStatus.code.in_(["active", "issued"])
        )
    ).scalars().all()
    return [s.id for s in statuses]


def _busy_item_ids_per_hour(
    db: Session,
    booking_date: date,
    busy_status_ids: list[int],
) -> dict[int, set[int]]:
    rows = db.execute(
        select(BookingSlot.hour, BookingItem.inventory_item_id)
        .join(Booking, Booking.id == BookingSlot.booking_id)
        .join(BookingItem, BookingItem.booking_id == Booking.id)
        .where(
            BookingSlot.booking_date == booking_date,
            Booking.status_id.in_(busy_status_ids),
        )
    ).all()

    result: dict[int, set[int]] = {h: set() for h in HOURS_RANGE}

    for hour, item_id in rows:
        result.setdefault(hour, set()).add(item_id)
    return result


def _free_items_of_type(
    db: Session,
    item_type_id: int,
    available_status_id: int,
) -> list[int]:
    return list(
        db.execute(
            select(InventoryItem.id).where(
                InventoryItem.item_type_id == item_type_id,
                InventoryItem.status_id == available_status_id,
            )
        ).scalars().all()
    )


def _free_items_with_size_value(
    db: Session,
    item_type_id: int,
    size_value: int,
    available_status_id: int,
) -> list[int]:
    return list(
        db.execute(
            select(InventoryItem.id).where(
                InventoryItem.item_type_id == item_type_id,
                InventoryItem.size_value == size_value,
                InventoryItem.status_id == available_status_id,
            )
        ).scalars().all()
    )


def _free_items_with_size_option(
    db: Session,
    item_type_id: int,
    size_option_code: str,
    available_status_id: int,
) -> list[int]:
    return list(
        db.execute(
            select(InventoryItem.id)
            .join(SizeOption, SizeOption.id == InventoryItem.size_option_id)
            .where(
                InventoryItem.item_type_id == item_type_id,
                SizeOption.code == size_option_code,
                InventoryItem.status_id == available_status_id,
            )
        ).scalars().all()
    )


def calculate_availability(
    db: Session,
    category_code: str,
    *,
    size_value: int | None = None,
    size_bucket: str | None = None,
    boot_size_value: int | None = None,
    start_date: date | None = None,
    days_count: int = 7,
) -> dict:
    category = _get_category(db, category_code)
    busy_status_ids = _busy_booking_status_ids(db)
    available_id = _available_status_id(db)

    if start_date is None:
        start_date = date.today()

    days_result = []

    for i in range(days_count):
        current_date = start_date + timedelta(days=i)
        busy = _busy_item_ids_per_hour(db, current_date, busy_status_ids)
        available_hours: list[int] = []

        for hour in HOURS_RANGE:
            if _is_hour_available(
                db,
                category_code,
                current_date,
                hour,
                busy.get(hour, set()),
                available_id,
                size_value=size_value,
                size_bucket=size_bucket,
                boot_size_value=boot_size_value,
            ):
                available_hours.append(hour)

        days_result.append(
            {"date": current_date, "available_hours": available_hours}
        )

    return {"category": category.code, "days": days_result}


def _is_hour_available(
    db: Session,
    category_code: str,
    current_date: date,
    hour: int,
    busy_item_ids: set[int],
    available_id: int,
    *,
    size_value: int | None,
    size_bucket: str | None,
    boot_size_value: int | None,
) -> bool:
    if category_code == "skates":
        if size_value is None:
            return False
        skate_type = _get_type(db, "skate")
        free = _free_items_with_size_value(db, skate_type.id, size_value, available_id)
        return any(i not in busy_item_ids for i in free)

    if category_code in ("skis", "snowboard"):
        if size_bucket is None or boot_size_value is None:
            return False
        board_code = "ski" if category_code == "skis" else "snowboard"
        boot_code = "ski_boot" if category_code == "skis" else "snowboard_boot"

        board_type = _get_type(db, board_code)
        boot_type = _get_type(db, boot_code)

        free_boards = _free_items_with_size_option(
            db, board_type.id, size_bucket, available_id
        )
        free_boots = _free_items_with_size_value(
            db, boot_type.id, boot_size_value, available_id
        )

        board_ok = any(i not in busy_item_ids for i in free_boards)
        boot_ok = any(i not in busy_item_ids for i in free_boots)
        return board_ok and boot_ok

    return False


def _get_type(db: Session, code: str) -> ItemType:
    return db.execute(
        select(ItemType).where(ItemType.code == code)
    ).scalar_one()

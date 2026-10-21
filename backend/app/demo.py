# Наполняет БД демоданными
# Запуск: python -m app.demo


from sqlalchemy import select
from app.database import SessionLocal
from passlib.context import CryptContext
from app.models import (
    Admin,
    BookingStatus,
    Category,
    InventoryItem,
    ItemStatus,
    ItemType,
    ItemTypeCategory,
    SizeOption,
)


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_or_create(db, model, defaults=None, **kwargs):
    obj = db.execute(select(model).filter_by(**kwargs)).scalar_one_or_none()
    if obj:
        return obj
    obj = model(**kwargs, **(defaults or {}))
    db.add(obj)
    db.flush()
    return obj


def seed_categories(db):
    data = [
        ("skates", "Коньки"),
        ("skis", "Лыжи"),
        ("snowboard", "Сноуборд"),
    ]
    result = {}
    for code, name in data:
        cat = get_or_create(db, Category, code=code, defaults={"name": name})
        result[code] = cat
    return result


def seed_item_statuses(db):
    data = [
        ("available", "Доступен"),
        ("rented", "Выдан"),
        ("broken", "Сломан"),
    ]
    result = {}
    for code, name in data:
        st = get_or_create(db, ItemStatus, code=code, defaults={"name": name})
        result[code] = st
    return result


def seed_booking_statuses(db):
    data = [
        ("active", "Активна"),
        ("issued", "Выдана"),
        ("completed", "Завершена"),
        ("cancelled", "Отменена"),
    ]
    result = {}
    for code, name in data:
        st = get_or_create(db, BookingStatus, code=code, defaults={"name": name})
        result[code] = st
    return result


def seed_item_types(db, categories):
    data = [
        ("skate", "Коньки", ["skates"], True),
        ("ski", "Лыжи горные", ["skis"], True),
        ("ski_boot", "Лыжные ботинки", ["skis"], True),
        ("snowboard", "Сноуборд", ["snowboard"], True),
        ("snowboard_boot", "Ботинки для сноуборда", ["snowboard"], True),
        ("helmet", "Шлем", ["skis", "snowboard"], True),
        ("goggles", "Очки (маска)", ["skis", "snowboard"], True),
        ("jacket", "Куртка", ["skis", "snowboard"], True),
        ("pants", "Штаны", ["skis", "snowboard"], True),
        ("gloves", "Перчатки", ["skis", "snowboard"], True),
        ("elbow_pads", "Налокотники", ["skates", "skis", "snowboard"], False),
        ("knee_pads", "Наколенники", ["skates", "skis", "snowboard"], False),
    ]

    result = {}
    for code, name, cat_codes, is_required in data:
        item_type = get_or_create(db, ItemType, code=code, defaults={"name": name})
        result[code] = item_type

        for cat_code in cat_codes:
            cat = categories[cat_code]
            link = db.execute(
                select(ItemTypeCategory).filter_by(
                    item_type_id=item_type.id, category_id=cat.id
                )
            ).scalar_one_or_none()
            if not link:
                db.add(
                    ItemTypeCategory(
                        item_type_id=item_type.id,
                        category_id=cat.id,
                        is_required=is_required,
                    )
                )
    return result


def seed_size_options(db, item_types):
    data = {
        "ski": ["S", "M", "L", "XL"],
        "snowboard": ["S", "M", "L", "XL"],
        "helmet": ["S", "M", "L"],
        "jacket": ["S", "M", "L", "XL"],
        "pants": ["S", "M", "L", "XL"],
        "gloves": ["S", "M", "L", "XL"],
        "elbow_pads": ["S", "M", "L", "XL"],
        "knee_pads": ["S", "M", "L", "XL"],
    }

    for type_code, codes in data.items():
        item_type = item_types[type_code]
        for code in codes:
            get_or_create(
                db,
                SizeOption,
                item_type_id=item_type.id,
                code=code,
                defaults={},
            )


def seed_admin(db):
    from app.utils.security import hash_password

    get_or_create(
        db,
        Admin,
        username="string",
        defaults={
            "password_hash": hash_password("string"),
            "last_name": "Демо",
            "first_name": "Админ",
            "middle_name": "Админович",
        },
    )


def _add_item(db, item_type_id, status_id, code, size_value=None, size_option_id=None):
    exists = db.execute(select(InventoryItem).filter_by(code=code)).scalar_one_or_none()
    if not exists:
        db.add(
            InventoryItem(
                item_type_id=item_type_id,
                status_id=status_id,
                code=code,
                size_value=size_value,
                size_option_id=size_option_id,
            )
        )


def seed_inventory(db, item_types, statuses):
    available = statuses["available"]

    # коньки
    counter = 1
    for size in [38, 40, 42, 44]:
        for _ in range(2):
            _add_item(db, item_types["skate"].id, available.id, f"SK-{counter:03d}", size_value=size)
            counter += 1

    # лыжи/сноуборды
    for type_code, prefix, buckets, count in [
        ("ski", "LS", ["M", "L"], 2),
        ("snowboard", "SB", ["M", "L"], 2),
    ]:
        counter = 1
        for bucket in buckets:
            so = db.execute(select(SizeOption).filter_by(item_type_id=item_types[type_code].id, code=bucket)).scalar_one()
            for _ in range(count):
                _add_item(db, item_types[type_code].id, available.id, f"{prefix}-{counter:03d}", size_option_id=so.id)
                counter += 1

    # ботинки
    for type_code, prefix in [("ski_boot", "LB"), ("snowboard_boot", "SBB")]:
        counter = 1
        for size in [40, 42, 44]:
            for _ in range(2):
                _add_item(db, item_types[type_code].id, available.id, f"{prefix}-{counter:03d}", size_value=size)
                counter += 1

    # шлем
    for bucket in ["S", "M", "L"]:
        so = db.execute(select(SizeOption).filter_by(item_type_id=item_types["helmet"].id, code=bucket)).scalar_one()
        for i in range(1, 3):
            _add_item(db, item_types["helmet"].id, available.id, f"HL-{bucket}-{i}", size_option_id=so.id)

    # одежда/защита
    clothing = ["jacket", "pants", "gloves", "elbow_pads", "knee_pads"]
    for type_code in clothing:
        for bucket in ["S", "M", "L", "XL"]:
            so = db.execute(select(SizeOption).filter_by(item_type_id=item_types[type_code].id, code=bucket)).scalar_one()
            _add_item(db, item_types[type_code].id, available.id, f"{type_code.upper()}-{bucket}", size_option_id=so.id)

    # очки
    for i in range(1, 4):
        _add_item(db, item_types["goggles"].id, available.id, f"GG-{i:03d}")


def main():
    db = SessionLocal()
    try:
        print("Seeding categories...")
        categories = seed_categories(db)

        print("Seeding item statuses...")
        item_statuses = seed_item_statuses(db)

        print("Seeding booking statuses...")
        seed_booking_statuses(db)

        print("Seeding item types...")
        item_types = seed_item_types(db, categories)

        print("Seeding size options...")
        seed_size_options(db, item_types)

        print("Seeding admin...")
        seed_admin(db)

        print("Seeding inventory...")
        seed_inventory(db, item_types, item_statuses)

        db.commit()
        print("Готово. База наполнена.")
    except Exception as e:
        db.rollback()
        print(f"Ошибка: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
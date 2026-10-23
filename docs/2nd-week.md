# Прокат горнолыжного снаряжения. Бэкенд.

## Что сделано

Серверная часть реализована и закрывает все функциональные требования MVP: просмотр категорий и типов снаряжения, выбор размера, расчёт свободных часов на 7 дней вперёд, создание брони без регистрации, просмотр и отмена броней по номеру телефона, авторизация администратора, управление инвентарём, выдача и приём возврата.

Ключевая особенность — бронирование без регистрации: клиент вводит только ФИО и телефон, а при получении называет последние 4 цифры телефона. Защита от двойного бронирования реализована через транзакцию с `SELECT ... FOR UPDATE` и составной внешний ключ на уровне БД.

API описан в OpenAPI-схеме и доступен в Swagger UI по адресу `/docs`. Читаемая версия той же схемы — ReDoc на `/redoc`.


## Стек

| Слой | Что используем |
|------|----------------|
| Язык | Python |
| Фреймворк | FastAPI |
| ORM | SQLAlchemy |
| Драйвер БД | psycopg3 |
| База | PostgreSQL |
| Валидация | Pydantic |
| Миграции | Alembic |
| Авторизация | JWT |


## Структура


```
backend/
├── app/
│   ├── main.py                 # точка входа, подключение роутеров
│   ├── config.py               # настройки из .env
│   ├── database.py             # engine, session, Base, get_db
│   ├── demo.py                 # наполнение БД демо-данными
│   ├── models/                 # SQLAlchemy-модели
│   ├── schemas/                # Pydantic-схемы
│   ├── routers/                # эндпоинты
│   │   └── deps.py             # get_current_admin
│   ├── services/               # бизнес-логика
│   └── utils/                  # JWT
├── alembic/                    # миграции
├── alembic.ini
└── requirements.txt
```

### Основные таблицы

| Таблица | Поля |
|---------|------|
| `clients` | `id`, `phone` (unique), `last_name`, `first_name`, `middle_name` |
| `admins` | `id`, `username` (unique), `password_hash`, `last_name`, `first_name`, `middle_name` |
| `inventory_items` | `id`, `item_type_id` FK, `size_option_id` FK, `status_id` FK, `code` (unique), `size_value` |
| `bookings` | `id`, `client_id` FK, `status_id` FK, `issued_by` FK, `created_at` |
| `booking_slots` | `id`, `booking_id` FK, `booking_date`, `hour`. Уникальность `(booking_id, booking_date, hour)` |
| `booking_items` | `id`, `booking_id` FK, `inventory_item_id` FK. Уникальность `(booking_id, inventory_item_id)` |

## Авторизация администратора

Клиент бронирует без регистрации. Авторизация нужна только админу.

- **`POST /auth/login`** — вход по `username` и `password`. Возвращает JWT-токен (24 часа) и ФИО.
- **`GET /auth/me`** — профиль текущего админа.

В payload токена лежат `sub` (username), `exp` (срок), `iat`.

## Категории и типы снаряжения

- **`GET /categories`** — публичный список категорий.
- **`GET /categories/{code}/item-types`** — типы снаряжения для категории. Возвращает флаг `is_required` (обязательно ли для этой категории) и список размеров.


| Категория | Обязательные типы | Опциональные |
|-----------|-------------------|--------------|
| Коньки | Коньки | Налокотники, наколенники |
| Лыжи | Лыжи, ботинки, шлем, очки, куртка, штаны, перчатки, налокотники, наколенники | — |
| Сноуборд | Сноуборд, ботинки, шлем, очки, куртка, штаны, перчатки, налокотники, наколенники | — |

## Доступность (свободные часы)

**`GET /availability`** — расчёт свободных часов на 7 дней вперёд

Параметры:

- `category` — `skates` / `skis` / `snowboard`
- `size_value` — EU-размер (для коньков и ботинок)
- `size_bucket` — S/M/L/XL (для лыж и сноуборда)
- `boot_size_value` — EU-размер ботинок (для лыж и сноуборда)
- `start_date` — по умолчанию сегодня
- `days` — 1..14

Ответ:

```json
{
  "category": "skates",
  "days": [
    {"date": "2026-10-22", "available_hours": [10, 11, 12, 14, 15]},
    {"date": "2026-10-23", "available_hours": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]}
  ]
}
```

Логика:

- Для **коньков** час свободен, если есть хотя бы одна единица типа `skate` нужного EU-размера, не занятая активной или выданной бронью
- Для **лыж/сноуборда** час свободен, только если **одновременно** свободны доска нужной корзины и ботинки нужного EU-размера.
- Недоступные часы не возвращаются вообще

## Бронирование

**`POST /bookings`** — создание брони.

Тело запроса:

```json
{
  "category": "skates",
  "phone": "+79161234567",
  "last_name": "Иванов",
  "first_name": "Иван",
  "middle_name": "Иванович",
  "booking_date": "2026-10-22",
  "hours": [14, 15],
  "size_value": 42
}
```

Валидация:

- `hours` не пустой, без повторов.
- Нельзя бронировать на прошедшую дату
- Нельзя бронировать на прошедший час 
- Для коньков обязателен `size_value`
- Для лыж/сноуборда обязательны `size_bucket` и `boot_size_value`

Защита от race condition:

1. Всё выполняется в одной транзакции.
2. Инвентарь подбирается через `SELECT ... FOR UPDATE SKIP LOCKED` — два одновременных запроса не возьмут одну единицу.
3. Составной уникальный ключ на `booking_items` не даст дважды добавить одну единицу в одну бронь.

Лимит: не больше 4 активных броней на один телефон.

## Мои брони

- **`GET /my-bookings?phone=...`** — все брони клиента по номеру телефона.
- **`POST /my-bookings/{id}/cancel?phone=...`** — отмена брони.

## Админка

### Инвентарь

- **`GET /admin/inventory`** — список единиц с фильтрами по типу и статусу.
- **`POST /admin/inventory`** — добавить единицу.
- **`DELETE /admin/inventory/{id}`** — удалить единицу.
- **`PATCH /admin/inventory/{id}/status`** — сменить статус (`available` / `rented` / `broken`).

### Выдача и возврат

- **`GET /admin/bookings?phone=...`** — найти брони клиента по телефону.
- **`GET /admin/bookings/{id}`** — данные брони по id.
- **`POST /admin/bookings/{id}/issue`** — выдать инвентарь. Статус брони → `issued`, инвентаря → `rented`, заполняется `issued_by`.
- **`POST /admin/bookings/{id}/complete`** — принять возврат. Статус брони → `completed`, инвентаря → `available`.

## API

| Метод | Адрес | Действие |
|-------|-------|----------|
| GET | `/health` | проверка работоспособности |
| GET | `/categories` | список категорий |
| GET | `/categories/{code}/item-types` | типы снаряжения для категории |
| GET | `/availability` | свободные часы |
| POST | `/bookings` | создать бронь |
| GET | `/my-bookings` | мои брони по телефону |
| POST | `/my-bookings/{id}/cancel` | отменить бронь |
| POST | `/auth/login` | вход админа |
| GET | `/auth/me` | профиль админа |
| GET | `/admin/inventory` | список инвентаря |
| POST | `/admin/inventory` | добавить единицу |
| DELETE | `/admin/inventory/{id}` | удалить единицу |
| PATCH | `/admin/inventory/{id}/status` | сменить статус |
| GET | `/admin/bookings` | найти брони по телефону |
| GET | `/admin/bookings/{id}` | данные брони по id (для QR) |
| POST | `/admin/bookings/{id}/issue` | выдать |
| POST | `/admin/bookings/{id}/complete` | принять возврат |
| GET | `/docs` | Swagger UI |
| GET | `/redoc` | ReDoc |

## Демо-данные

Скрипт `app/demo.py` наполняет базу справочниками и тестовым инвентарём. Идемпотентен: повторный запуск не создаёт дубликаты.

Запуск:

```
python -m app.demo
```
## Требования

| ID | Требование | Как реализовано |
|----|-----------|-----------------|
| FR-01 | Просмотр категорий | `GET /categories` |
| FR-02 | Выбор размера | `GET /categories/{code}/item-types` с размерами |
| FR-03 | Свободные часы на 7 дней | `GET /availability`, один запрос на дату |
| FR-04 | Бронирование без регистрации | `POST /bookings`, только ФИО и телефон |
| FR-05 | Лимит броней на телефон | Проверка в `create_booking`, 4 активные |
| FR-06 | Просмотр и отмена броней | `GET /my-bookings`, `POST /my-bookings/{id}/cancel` |
| FR-07 | Авторизация админа | JWT + bcrypt, `get_current_admin` |
| FR-08 | Управление инвентарём | CRUD через `/admin/inventory` |
| FR-09 | Выдача и возврат | `/admin/bookings/{id}/issue`, `/complete` |
| NFR-01 | Хеширование паролей | bcrypt, в БД только хеш |
| NFR-02 | Защита от race condition | `SELECT ... FOR UPDATE SKIP LOCKED` |
| NFR-03 | Чужие брони недоступны | Проверка телефона в `cancel_booking`, 404 |
| NFR-04 | Свободные часы динамические | Учитываются брони в статусах `active` и `issued` |
| NFR-05 | Прошедшие часы не показываются | Валидация даты и часа в `create_booking` |
| NFR-06 | 3НФ | Справочники, составные атрибуты разбиты, вычисляемых полей нет |

## Как запустить

```
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# создать БД
psql -U postgres
CREATE DATABASE skate_reservation_db;
\q

# применить миграции
alembic upgrade head

# демо-данные
python -m app.demo

# запустить
uvicorn app.main:app --reload
```

API: http://localhost:8000  
Swagger: http://localhost:8000/docs
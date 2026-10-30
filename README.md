# Прокат горнолыжного снаряжения

Команда:
* Волков Дмитрий Алексеевич
* Ивановский Никита Дмитриевич
* Ерофеев Артем Александрович
* Дудник Валерий Валерьевич

## Стек технологий

| Слой | Технологии |
|------|------------|
| **Бэкенд** | Python 3.14, FastAPI, SQLAlchemy, Pydantic, Alembic, PostgreSQL, psycopg3 |
| **Фронтенд** | TypeScript, React, Vite, TanStack Query, qrcode.react |
| **Авторизация** | JWT, bcrypt |
| **Документация** | Swagger UI (OpenAPI), ReDoc |



## Запуск

1. **Создайте окружение:**
   ```cmd
   cd backend
   python -m venv .venv
   .venv\Scripts\activate
   ```

2. **Установите зависимости:**
   ```cmd
   pip install -r requirements.txt
   ```

3. **Настройте переменные окружения:**
   Скопируй `.env.example` в `.env` и заполни:
   ```env
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/skate_reservation_db
   JWT_SECRET_KEY=твой_секретный_ключ
   ```

4. **Создайте базу данных:**
   ```sql
   CREATE DATABASE skate_reservation_db;
   ```

5. **Примените миграции и загрузите демо-данные:**
   ```cmd
   alembic upgrade head
   python -m app.demo
   ```

6. **Запустите сервер:**
   ```cmd
   uvicorn app.main:app --reload
   ```

7. **Откройте новое окно терминала и перейдите в папку фронтенда:**
   ```cmd
   cd frontend
   ```

8. **Установите зависимости:**
   ```cmd
   npm install
   ```

9. **Создайте файл `.env.local`:**
   ```env
   API_TARGET=http://127.0.0.1:8000
   VITE_RENTAL_TIMEZONE=Europe/Moscow
   ```

10. **Запустите приложение:**
   ```cmd
   npm run dev
   ```

**Документация API (Swagger):** http://127.0.0.1:8000/docs  
**Приложение доступно по адресу:** http://127.0.0.1:5173  
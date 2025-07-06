# Enter Code Site Backend

FastAPI backend для образовательной платформы. Использует MongoDB и Beanie ODM.

## Быстрый старт

1. Установите зависимости:
   ```bash
   pip install poetry
   poetry install
   ```
2. Запустите MongoDB на localhost:27017.
3. Запуск приложения:
   ```bash
   poetry run uvicorn main:app --reload
   ```

## Основные эндпоинты

- `GET /` — главная страница
- `GET /users` — список всех пользователей
- `POST /users` — добавить пользователя (JSON: name, surname, email, user_type, status, phone, avatar_url, bio)
- `GET /user_0` — создать и вернуть тестового пользователя
- `GET /db_check` — проверка подключения к базе данных

## Модель пользователя (User)

- `id` (str, уникальный)
- `name` (str)
- `surname` (str)
- `email` (str, уникальный)
- `user_type` (student/teacher/admin)
- `status` (active/inactive)
- `phone` (str, уникальный, опционально)
- `avatar_url` (str, опционально)
- `bio` (str, опционально)

## Зависимости
- fastapi
- uvicorn
- beanie
- motor
- pydantic 
# Enter Code Site

Быстрый перезапуск Docker одной командой: `docker compose up -d --build --force-recreate`

Enter Code Site - это учебная платформа с React-фронтендом, FastAPI-бэкендом и MongoDB.

## Что сейчас уже сделано

- Есть страницы входа, регистрации, профиля, расписания, событий и обучения.
- Есть роли `student`, `teacher`, `admin`.
- Админ может управлять учетными записями учащихся.
- Ученик видит свои курсы, прогресс по баллам, уроки, задачи, рейтинг и достижения.
- Преподаватель может редактировать конспект урока, добавлять задачи, тесты и стоимость задач в баллах.
- Решения ученика запускаются на локальных Python-тестах. Если тесты проходят, задача засчитывается и начисляются баллы.
- Есть базовая система достижений и обработка событий: первый вход, первая отправка решения, первая решенная задача.
- Есть публичное расписание и админка событий.
- Docker-конфиг уже настроен с авторизацией MongoDB, healthcheck'ами и автоматическим перезапуском сервисов.

## Что пока не закончено

- Полноценные e2e- и API-тесты еще не написаны.
- Автопроверка пока работает только для Python.
- Запуск пользовательского кода пока не изолирован отдельным контейнером.
- Нужны дополнительные проверки прав доступа, UX-полировка и более понятные ошибки на фронте.

## Быстрый старт через Docker

1. Создать локальные env-файлы по шаблонам:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

2. Заполнить пароли и нужные переменные в `.env` и `backend/.env`.

3. Поднять проект:

```bash
docker compose up -d --build
```

После запуска:

- фронтенд: `http://localhost:3001`
- бэкенд: `http://localhost:8002`
- Swagger: `http://localhost:8002/docs`
- MongoDB: `localhost:27020`

## Запуск без Docker

### Backend

```bash
cd backend
poetry install
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8002
```

Для локального запуска нужен рабочий `backend/.env` и поднятая MongoDB.

### Frontend

```bash
cd frontend
npm install
npm start
```

Если бэкенд работает не на `http://localhost:8002`, нужно поменять `REACT_APP_API_URL`.

## Env-шаблоны

- [.env.example](c:\Users\arfa3\PycharmProjects\Enter-Code-Site\.env.example) - переменные для Docker и MongoDB
- [backend/.env.example](c:\Users\arfa3\PycharmProjects\Enter-Code-Site\backend\.env.example) - настройки бэкенда, URL MongoDB, базовые лимиты раннера
- [frontend/.env.example](c:\Users\arfa3\PycharmProjects\Enter-Code-Site\frontend\.env.example) - URL API для фронтенда

## Технические детали

- MongoDB теперь запускается с логином и паролем.
- `docker-compose` ждет готовности MongoDB и backend по healthcheck'ам.
- Backend держит один общий Mongo-клиент на процесс и корректно закрывает его при остановке.
- Начальные учетные записи `admin` и `teacher` можно переопределить через `DEFAULT_ADMIN_*` и `DEFAULT_TEACHER_*` в `backend/.env`.

## Основные маршруты

- `/login` - вход
- `/register` - регистрация
- `/profile` - личный кабинет
- `/mycourses` - мои курсы
- `/course/:courseId` - курс и рейтинг
- `/lesson/:lessonId` - урок, конспект и задачи
- `/events` - расписание и события
- `/admin/events` - управление событиями

# Enter Code Site

Enter Code Site — учебная платформа на React, FastAPI и MongoDB. В проекте уже собраны основные сценарии для ученика, родителя, преподавателя и администратора: курсы, уроки, задачи, группы, расписание, посещаемость, оплаты, достижения, новости и публичные страницы курсов.

## Что уже работает

- Публичные страницы: главная, новости, расписание, страница курса и заявка на курс.
- Роли: `student`, `parent`, `teacher`, `admin`.
- Контур ученика: мои курсы, уроки по прогрессу, задачи, история попыток, профиль, достижения и личное расписание.
- В задачах: подсветка Python, локальный запуск на своих входных данных, показ `stdout` и `stderr`, локальный черновик и сброс к стартовому шаблону.
- Контур родителя: отдельный кабинет с привязанными детьми, прогрессом по курсам, посещаемостью и статусом оплат.
- Контур преподавателя и администратора: курсы, группы, уроки, задачи, ручная проверка, ученики, посещаемость, оплаты и события.
- В разделе учеников можно не только назначать курсы, но и создавать или привязывать родительские аккаунты.
- Создание курса перенесено в modal, обложка загружается файлом, а не ссылкой.
- Новости вынесены в backend API: teacher/admin могут создавать и редактировать их прямо в интерфейсе.
- Публичная страница курса показывает реальные группы и структуру уроков.
- Есть минимальный backend-набор `unittest`: auth, публичный курс, урок, задачи, ручная проверка и один smoke-flow `login -> course -> lesson -> submit`.
- Python-раннер запускается в более изолированном режиме: с `-I -B -S`, урезанным окружением и лимитом по времени.
- При старте backend может заполнить демо-курс по Python.

## Текущие ограничения

- Автопроверка пока есть только для Python.
- Выполнение пользовательского кода все еще идет в процессе backend и не вынесено в отдельный sandbox/container.

## Быстрый старт через Docker

1. Создать локальные env-файлы:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

2. Поднять стек:

```powershell
docker compose up -d --build
```

После запуска:

- frontend: `http://localhost:3001`
- backend API: `http://localhost:8002`
- Swagger: `http://localhost:8002/docs`
- MongoDB: `localhost:27020`

Backend по умолчанию:

- создает `admin` и `teacher`, если их еще нет;
- может заполнить демо-курс, если `SEED_PYTHON_DEMO_CONTENT=true`.

## Запуск без Docker

### Backend

```powershell
cd backend
poetry install
poetry run uvicorn main:app --reload --host 0.0.0.0 --port 8002
```

Нужно, чтобы были настроены `backend/.env` и MongoDB по `MONGODB_URL`.

Проверка backend:

```powershell
poetry run python -m unittest discover -s tests -t . -v
poetry run python -m compileall .
```

### Frontend

```powershell
cd frontend
npm install
npm start
```

Frontend использует `REACT_APP_API_URL`, по умолчанию `http://localhost:8002`.

## Env-файлы

- [`.env.example`](C:/Users/arfa3/PycharmProjects/Enter-Code-Site/.env.example) — порты Docker и root-данные MongoDB.
- [`backend/.env.example`](C:/Users/arfa3/PycharmProjects/Enter-Code-Site/backend/.env.example) — backend-настройки, стартовые пользователи, сидинг демо-данных и лимиты раннера.
- [`frontend/.env.example`](C:/Users/arfa3/PycharmProjects/Enter-Code-Site/frontend/.env.example) — URL API для frontend.

## Основные маршруты

- `/` — главная.
- `/news` — новости проекта.
- `/events` — публичное расписание.
- `/courses/:courseId` — публичная страница курса.
- `/login` — вход.
- `/profile` — профиль.
- `/mycourses` — список курсов ученика, преподавателя или администратора.
- `/mycourses/:courseId` — рабочая страница курса.
- `/mycourses/:courseId/lessons/:lessonId` — урок и задачи.
- `/students` — работа с учениками и их родителями.
- `/teaching` — занятия, ручная проверка и заявки.

## Что дальше

Базовый продуктовый и технический каркас закрыт. Дальнейшие шаги — по необходимости; короткая очередь лежит в [NEXT_STEPS.md](C:/Users/arfa3/PycharmProjects/Enter-Code-Site/NEXT_STEPS.md).

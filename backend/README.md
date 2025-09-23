# Enter Code Site Backend

Современный бэкенд образовательной платформы для обучения программированию, построенный на FastAPI, MongoDB и Beanie ODM.

## 🚀 Ключевые особенности

- **Современная архитектура**: FastAPI + MongoDB + Beanie ODM
- **JWT аутентификация**: Access/Refresh токены для безопасности
- **Ролевая модель**: Студенты, преподаватели, администраторы
- **Система абонементов**: Управление занятиями для студентов
- **Гибкая структура курсов**: Курсы → Группы → Темы → Задачи
- **Стабильные связи**: Использование user_id вместо изменяемых username

## 📋 Архитектура системы

### Модели данных

#### 👤 User (Пользователь)
```python
- id: ObjectId (уникальный идентификатор)
- name: str (имя)
- surname: str (фамилия)
- tg_username: str (Telegram username)
- user_type: enum (student/teacher/admin)
- status: enum (active/inactive)
- phone: str (номер телефона, опционально)
- avatar_url: str (URL аватара, опционально)
- bio: str (биография, опционально)
- password_hash: str (хэш пароля)
- access_token: str (JWT токен доступа)
- refresh_token: str (токен обновления)

# Для студентов:
- subscription_status: enum (paid/unpaid/expired)
- lessons_remaining: int (количество оставшихся занятий)
```

#### 🏫 Course (Курс)
```python
- id: ObjectId
- name: str (название курса)
- description: str (описание)
- group_ids: List[str] (список ID групп)
- topic_ids: List[str] (список ID тем)
```

#### 👥 Group (Группа)
```python
- id: ObjectId
- course_id: str (ID курса)
- name: str (название группы)
- description: str (описание)
- students: List[str] (список user_id студентов)
- teachers: List[str] (список user_id преподавателей)
```

#### 📚 Topic (Тема)
```python
- id: ObjectId
- name: str (название темы)
- description: str (описание)
- resources: List[str] (ресурсы)
- task_ids: List[str] (список ID задач)
```

#### 📝 Task (Задача)
```python
- id: ObjectId
- topic_id: str (ID темы)
- condition: str (условие задачи)
- attachments: List[str] (приложения)
- chat_history: List[dict] (история чата с ИИ)
- results: List[TaskResult] (результаты студентов)
```

#### 📊 TaskResult (Результат задачи)
```python
- user_id: str (ID пользователя)
- score: float (оценка)
- status: enum (no_attempts/wrong_answer/under_review/rejected/correct)
```

## 🛠 API Эндпойнты

### 🔐 Аутентификация (`/auth`)

| Метод | Эндпойнт | Описание | Токен |
|-------|----------|----------|-------|
| POST | `/auth/register` | Регистрация + автоматическая авторизация | ❌ |
| POST | `/auth/login` | Вход в систему | ❌ |
| POST | `/auth/me` | Информация о текущем пользователе | ✅ |
| POST | `/auth/user_info` | Базовая информация по user_id | ❌ |
| POST | `/auth/refresh` | Обновление access_token | ✅ |
| POST | `/auth/change_password` | Смена пароля | ✅ |
| POST | `/auth/update_user` | Обновление профиля | ✅ |
| POST | `/auth/logout` | Выход из системы | ✅ |
| DELETE | `/auth/delete_account` | Удаление аккаунта | ✅ |

### 👥 Пользователи (`/users`)

| Метод | Эндпойнт | Описание | Роль |
|-------|----------|----------|------|
| POST | `/users/list` | Список всех пользователей | Admin |
| POST | `/users/profile` | Профиль пользователя | Student+ |
| POST | `/users/search` | Поиск пользователей | Teacher+ |

### 🏫 Курсы (`/courses`)

| Метод | Эндпойнт | Описание | Роль |
|-------|----------|----------|------|
| POST | `/courses/add` | Создать курс | Teacher+ |
| POST | `/courses/update` | Обновить курс | Teacher+ |
| POST | `/courses/info` | Информация о курсе | Student+ |
| POST | `/courses/list` | Список курсов | Student+ |
| POST | `/courses/my` | Курсы пользователя | Student+ |

### 👥 Группы (`/groups`)

| Метод | Эндпойнт | Описание | Роль |
|-------|----------|----------|------|
| POST | `/groups/add` | Создать группу | Teacher+ |
| POST | `/groups/update` | Обновить группу | Teacher+ |
| POST | `/groups/add_student` | Добавить студента | Teacher+ |
| POST | `/groups/add_students_bulk` | Массово добавить студентов | Teacher+ |
| POST | `/groups/remove_student` | Удалить студента | Teacher+ |
| POST | `/groups/add_teacher` | Добавить преподавателя | Admin |
| POST | `/groups/remove_teacher` | Удалить преподавателя | Admin |
| POST | `/groups/info` | Информация о группе | Student+ |
| POST | `/groups/list` | Список групп | Student+ |
| POST | `/groups/my` | Группы пользователя | Student+ |

### 📚 Темы (`/topics`)

| Метод | Эндпойнт | Описание | Роль |
|-------|----------|----------|------|
| POST | `/topics/add` | Создать тему | Teacher+ |
| POST | `/topics/update` | Обновить тему | Teacher+ |
| POST | `/topics/info` | Информация о теме | Student+ |
| POST | `/topics/result` | Прогресс студента по теме | Student+ |
| POST | `/topics/list` | Список тем | Student+ |

### 📝 Задачи (`/tasks`)

| Метод | Эндпойнт | Описание | Роль |
|-------|----------|----------|------|
| POST | `/tasks/add` | Создать задачу | Teacher+ |
| POST | `/tasks/update` | Обновить задачу | Teacher+ |
| POST | `/tasks/info` | Информация о задаче | Student+ |
| POST | `/tasks/submit` | Отправить решение | Student |
| POST | `/tasks/student_status` | Статус студента по задаче | Student+ |

### 💳 Абонементы (`/subscription`)

| Метод | Эндпойнт | Описание | Роль |
|-------|----------|----------|------|
| POST | `/subscription/extend` | Продлить абонемент | Teacher+ |
| POST | `/subscription/info` | Информация об абонементе | Student+ |
| POST | `/subscription/use-lesson` | Списать занятие | Teacher+ |
| POST | `/subscription/check-validity` | Проверить действительность | Student+ |

## � Недавние улучшения

### ⚡ Версия 2.0.0 - Крупное обновление архитектуры

#### 🏗 Миграция на user_id
- **Стабильные идентификаторы**: Переход от `tg_username` к `user_id` во всех связях
- **Целостность данных**: Исключены проблемы при смене username пользователями
- **Обратная совместимость**: API продолжает принимать tg_username с автоматической конвертацией

#### 🔐 Улучшения аутентификации
- **Автоматическая авторизация**: `/auth/register` сразу возвращает токены и user_id
- **Расширенные ответы**: `/auth/login` и `/auth/me` включают user_id
- **Новый эндпойнт**: `/auth/user_info` для получения базовой информации по user_id

#### 🛡 Комплексная обработка ошибок
- **Глобальные обработчики**: Централизованная обработка HTTPException и общих ошибок
- **Детальное логирование**: Все ошибки записываются с контекстом для отладки
- **Безопасные сообщения**: Пользователи получают понятные сообщения без технических деталей
- **Надежность сервисов**: Try-catch блоки во всех критических методах

#### 🔍 Улучшенный мониторинг
- **Health Check**: Проверка состояния MongoDB в `/health`
- **Structured Logging**: Логи с временными метками и уровнями важности
- **Error Tracking**: Автоматическое отслеживание и логирование ошибок

#### 📝 Документация
- **Актуальная схема API**: Обновленная документация всех эндпойнтов
- **Migration Guide**: Инструкции по миграции данных
- **Error Handling Guide**: Подробное описание обработки ошибок

## �🔧 Установка и запуск

### Требования
- Python 3.8+
- MongoDB 4.4+
- pip или poetry

### Установка зависимостей

#### С Poetry (рекомендуется)
```bash
poetry install
poetry shell
```

#### С pip
```bash
pip install -r requirements.txt
```

### Настройка окружения

Создайте файл `.env`:
```env
# База данных
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=enter_code_site

# JWT токены
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Логирование
LOG_FILE=app.log
LOG_LEVEL=INFO

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Запуск сервера

#### Разработка
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

#### Продакшн
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

#### Используя VS Code Task
```bash
# Ctrl+Shift+P -> Tasks: Run Task -> Start Backend Server
```

## 🗄 База данных

### MongoDB коллекции
- `users` - пользователи системы
- `courses` - курсы
- `groups` - группы студентов
- `topics` - темы курсов
- `tasks` - задачи
- `task_results` - результаты выполнения задач

### Миграция данных

При обновлении с версий, использующих `tg_username` в связях:

```bash
# Создание резервной копии и миграция
python migrate_to_user_id.py

# Или с помощью скрипта
./run_migration.ps1  # Windows
./run_migration.sh   # Linux/Mac
```

## 🔒 Безопасность

### Аутентификация
- **JWT токены**: Access (30 мин) + Refresh (7 дней)
- **Хэширование паролей**: bcrypt
- **Автоматическое обновление**: через refresh token

### Авторизация
- **Ролевая модель**: Student < Teacher < Admin
- **Проверка прав**: на уровне эндпойнтов
- **Изоляция данных**: студенты видят только свои данные

### CORS
- **Настраиваемые домены**: через переменные окружения
- **Безопасные заголовки**: включены по умолчанию

## 📊 Мониторинг и логирование

### Логи
- **Файл**: `app.log` (настраивается)
- **Уровни**: INFO, WARNING, ERROR
- **Ротация**: автоматическая

### Здоровье системы
```bash
GET /health
```

### Метрики
- Время ответа эндпойнтов
- Количество активных пользователей
- Статистика использования

## 🧪 Тестирование

```bash
# Запуск тестов
pytest

# С покрытием
pytest --cov=.

# Только unit тесты
pytest tests/unit/

# Только integration тесты
pytest tests/integration/
```

## 📝 Документация API

После запуска сервера доступна по адресам:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## 🚀 Деплой

### Docker
```bash
# Сборка образа
docker build -t enter-code-site-backend .

# Запуск контейнера
docker run -p 8000:8000 --env-file .env enter-code-site-backend
```

### Docker Compose
```bash
docker-compose up -d
```

## 🤝 Разработка

### Структура проекта
```
backend/
├── main.py                 # Точка входа
├── database/              # Конфигурация БД
├── models/                # Модели данных
├── routers/               # API роутеры
├── services/              # Бизнес-логика
├── schemas/               # Pydantic схемы
├── migrate_to_user_id.py  # Скрипт миграции
├── requirements.txt       # Зависимости pip
├── pyproject.toml        # Конфигурация Poetry
└── README.md             # Документация
```

### Код стайл
- **Форматтер**: black
- **Линтер**: flake8
- **Импорты**: isort
- **Типы**: mypy

### Git hooks
```bash
# Установка pre-commit
pre-commit install
```

## 📈 Версионирование

Текущая версия: **2.0.0**

### Changelog
- **2.0.0**: Миграция на user_id, обновленные API ответы
- **1.0.0**: Первоначальная версия с базовой функциональностью

## 📞 Поддержка

- **Issues**: GitHub Issues
- **Документация**: `/docs` эндпойнт
- **Email**: support@entercode.site

---

**Разработано с ❤️ для образования в программировании**
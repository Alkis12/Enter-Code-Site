import logging
import os

import motor.motor_asyncio
from beanie import init_beanie
from dotenv import load_dotenv
from passlib.context import CryptContext

from models.achievement import Achievement
from models.attendance import AttendanceSession
from models.course import Course
from models.course_request import CourseRequest
from models.event import Event
from models.group import Group
from models.task import Task
from models.topic import Topic
from models.user import User, UserType
from services.achievement_service import ensure_default_achievements
from services.seed_learning_content_service import ensure_python_demo_learning_content


load_dotenv()
logger = logging.getLogger("database")
MONGODB_URL = os.getenv("MONGODB_URL")
DEFAULT_ADMIN_USERNAME = os.getenv("DEFAULT_ADMIN_USERNAME", "admin")
DEFAULT_ADMIN_PASSWORD = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin123")
DEFAULT_TEACHER_USERNAME = os.getenv("DEFAULT_TEACHER_USERNAME", "teacher")
DEFAULT_TEACHER_PASSWORD = os.getenv("DEFAULT_TEACHER_PASSWORD", "teacher123")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
mongo_client: motor.motor_asyncio.AsyncIOMotorClient | None = None


def get_mongo_client() -> motor.motor_asyncio.AsyncIOMotorClient:
    global mongo_client

    if mongo_client is None:
        if not MONGODB_URL:
            raise RuntimeError("MONGODB_URL is not configured")
        mongo_client = motor.motor_asyncio.AsyncIOMotorClient(
            MONGODB_URL,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=5000,
        )

    return mongo_client


def get_database():
    return get_mongo_client().get_default_database()


async def ping_database():
    await get_mongo_client().admin.command("ping")


async def init_database():
    try:
        await ping_database()
        database = get_database()

        document_models = [
            User,
            Course,
            CourseRequest,
            Group,
            Task,
            Topic,
            Event,
            Achievement,
            AttendanceSession,
        ]
        await init_beanie(database=database, document_models=document_models)

        await create_custom_indexes(database)
        await ensure_default_achievements()
        await ensure_default_staff_users()
        await ensure_python_demo_learning_content()
    except Exception:
        logger.exception("Database initialization failed")
        await close_database()
        raise

    logger.info("Database initialized successfully")


async def create_custom_indexes(database):
    try:
        user_indexes = await database.users.index_information()
        if "phone_1" in user_indexes:
            await database.users.drop_index("phone_1")

        await database.users.create_index("tg_username", unique=True)
        await database.users.create_index(
            "phone",
            unique=True,
            partialFilterExpression={"phone": {"$type": "string"}},
        )
        await database.users.create_index("telegram_id", sparse=True)

        await database.courses.create_index("teacher_ids")
        await database.courses.create_index("student_ids")
        await database.course_requests.create_index("course_id")
        await database.course_requests.create_index("created_at")

        await database.groups.create_index("course_id")
        await database.groups.create_index("students")
        await database.groups.create_index("teachers")
        await database.attendance_sessions.create_index([("group_id", 1), ("date", 1)], unique=True)
        await database.attendance_sessions.create_index("course_id")

        await database.tasks.create_index("topic_id")

        await database.topics.create_index("course_id")

        await database.achievements.create_index("key", unique=True)
        await database.achievements.create_index("course_id")
    except Exception as exc:
        logger.warning("Error creating indexes: %s", exc)


async def ensure_default_staff_users():
    defaults = [
        {
            "tg_username": DEFAULT_ADMIN_USERNAME,
            "name": "Admin",
            "surname": "User",
            "user_type": UserType.ADMIN,
            "password": DEFAULT_ADMIN_PASSWORD,
        },
        {
            "tg_username": DEFAULT_TEACHER_USERNAME,
            "name": "Teacher",
            "surname": "User",
            "user_type": UserType.TEACHER,
            "password": DEFAULT_TEACHER_PASSWORD,
        },
    ]

    for payload in defaults:
        existing = await User.find_one(User.tg_username == payload["tg_username"])
        if existing:
            continue
        user = User(
            name=payload["name"],
            surname=payload["surname"],
            tg_username=payload["tg_username"],
            user_type=payload["user_type"],
            password_hash=pwd_context.hash(payload["password"]),
        )
        await user.insert()


async def close_database():
    global mongo_client

    if mongo_client is None:
        return

    mongo_client.close()
    mongo_client = None
    logger.info("Database connection closed")

import motor.motor_asyncio
from beanie import init_beanie
from models.user import User
from models.course import Course
from models.group import Group
from models.task import Task, TaskResult
from models.topic import Topic
import logging
import os
from dotenv import load_dotenv


load_dotenv()
logger = logging.getLogger("database")
MONGODB_URL = os.getenv("MONGODB_URL")

async def init_database():
    """Инициализация базы данных MongoDB и Beanie ODM."""
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
    database = client.get_default_database()
    
    # Список всех моделей документов
    document_models = [User, Course, Group, Task, TaskResult, Topic]
    
    # Инициализируем Beanie с всеми моделями
    await init_beanie(database=database, document_models=document_models)
    
    # Создаем дополнительные индексы для оптимизации
    await create_custom_indexes(database)
    
    logger.info("Database initialized successfully")

async def create_custom_indexes(database):
    """Создает дополнительные индексы для оптимизации запросов."""
    try:
        # Индексы для коллекции пользователей
        if "user" in await database.list_collection_names():
            user_collection = database.user
            await user_collection.create_index("tg_username", unique=True)
            await user_collection.create_index("phone", unique=True, sparse=True)
            logger.info("Created indexes for User collection")
        
        # Индексы для коллекции групп
        if "group" in await database.list_collection_names():
            group_collection = database.group
            await group_collection.create_index("course_id")
            await group_collection.create_index("students")
            await group_collection.create_index("teachers")
            logger.info("Created indexes for Group collection")
        
        # Индексы для коллекции задач
        if "task" in await database.list_collection_names():
            task_collection = database.task
            await task_collection.create_index("topic_id")
            logger.info("Created indexes for Task collection")
        
        # Индексы для коллекции результатов задач
        if "taskresult" in await database.list_collection_names():
            taskresult_collection = database.taskresult
            await taskresult_collection.create_index("tg_username")
            await taskresult_collection.create_index([("tg_username", 1), ("task_id", 1)], unique=True)
            logger.info("Created indexes for TaskResult collection")
        
        # Индексы для коллекции тем
        if "topic" in await database.list_collection_names():
            topic_collection = database.topic
            await topic_collection.create_index("course_id")
            logger.info("Created indexes for Topic collection")
            
    except Exception as e:
        logger.warning(f"Error creating indexes: {e}")

async def close_database():
    """Закрытие соединения с базой данных MongoDB."""
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
    client.close()
    logger.info("Database connection closed")
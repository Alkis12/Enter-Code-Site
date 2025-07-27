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
    
    # Проверяем и логируем существующие коллекции
    await check_collections(database)
    
    # Валидируем модели документов
    await validate_document_models(document_models, database)
    
    logger.info("Database initialized successfully")

async def validate_document_models(document_models, database):
    """Валидирует все модели документов."""
    from database.utils import validate_document_model
    
    for model in document_models:
        try:
            await validate_document_model(model, database)
        except Exception as e:
            logger.warning(f"Model {model.__name__} validation failed: {e}")

async def check_collections(database):
    """Проверяет существующие коллекции и создает индексы при необходимости."""
    collections = await database.list_collection_names()
    
    # Ожидаемые коллекции (имена классов в нижнем регистре)
    expected_collections = ["user", "course", "group", "task", "taskresult", "topic"]
    
    logger.info(f"Existing collections: {collections}")
    
    for collection_name in expected_collections:
        if collection_name not in collections:
            logger.info(f"Collection '{collection_name}' does not exist yet - will be created on first document insert")
        else:
            logger.info(f"Collection '{collection_name}' exists")
    
    # Создаем дополнительные индексы для оптимизации
    await create_custom_indexes(database)

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
            await taskresult_collection.create_index("user_id")
            await taskresult_collection.create_index([("user_id", 1), ("task_id", 1)], unique=True)
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
"""
Утилиты для работы с базой данных MongoDB
"""
import logging
from typing import List, Type
from beanie import Document
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("database")

async def ensure_collection_exists(database: AsyncIOMotorDatabase, collection_name: str) -> bool:
    """
    Проверяет существование коллекции и создает её при необходимости.
    
    Args:
        database: Экземпляр базы данных MongoDB
        collection_name: Имя коллекции
        
    Returns:
        bool: True если коллекция существовала или была создана успешно
    """
    try:
        collections = await database.list_collection_names()
        
        if collection_name not in collections:
            # Создаем коллекцию, вставляя и сразу удаляя временный документ
            await database[collection_name].insert_one({"_temp": True})
            await database[collection_name].delete_one({"_temp": True})
            logger.info(f"Created collection: {collection_name}")
            return True
        else:
            logger.debug(f"Collection {collection_name} already exists")
            return True
            
    except Exception as e:
        logger.error(f"Error ensuring collection {collection_name} exists: {e}")
        return False

async def ensure_collections_exist(database: AsyncIOMotorDatabase, collection_names: List[str]) -> bool:
    """
    Проверяет существование нескольких коллекций и создает их при необходимости.
    
    Args:
        database: Экземпляр базы данных MongoDB
        collection_names: Список имен коллекций
        
    Returns:
        bool: True если все коллекции существовали или были созданы успешно
    """
    success = True
    for collection_name in collection_names:
        if not await ensure_collection_exists(database, collection_name):
            success = False
    return success

async def get_collection_stats(database: AsyncIOMotorDatabase, collection_name: str) -> dict:
    """
    Получает статистику коллекции.
    
    Args:
        database: Экземпляр базы данных MongoDB
        collection_name: Имя коллекции
        
    Returns:
        dict: Статистика коллекции или пустой словарь в случае ошибки
    """
    try:
        if collection_name in await database.list_collection_names():
            stats = await database.command("collStats", collection_name)
            return {
                "count": stats.get("count", 0),
                "size": stats.get("size", 0),
                "avgObjSize": stats.get("avgObjSize", 0),
                "indexes": stats.get("nindexes", 0)
            }
        else:
            return {"count": 0, "size": 0, "avgObjSize": 0, "indexes": 0}
    except Exception as e:
        logger.error(f"Error getting stats for collection {collection_name}: {e}")
        return {}

async def validate_document_model(model_class: Type[Document], database: AsyncIOMotorDatabase) -> bool:
    """
    Проверяет, что модель документа корректно настроена для работы с базой данных.
    
    Args:
        model_class: Класс модели документа Beanie
        database: Экземпляр базы данных MongoDB
        
    Returns:
        bool: True если модель настроена корректно
    """
    try:
        collection_name = model_class.get_collection_name()
        
        # Проверяем, что коллекция существует или может быть создана
        await ensure_collection_exists(database, collection_name)
        
        # Проверяем, что можно выполнить базовые операции
        await model_class.find_one()  # Это не должно вызвать ошибку, даже если коллекция пуста
        
        logger.info(f"Document model {model_class.__name__} validated successfully")
        return True
        
    except Exception as e:
        logger.error(f"Error validating document model {model_class.__name__}: {e}")
        return False

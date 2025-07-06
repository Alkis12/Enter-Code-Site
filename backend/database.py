from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from models.user import User


async def init_database():
    """Инициализация подключения к базе данных"""
    # Подключение к MongoDB
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    await client.enter_code_site.command("ping")
    print("Подключение к базе данных успешно установлено")

    # Инициализация Beanie с нашими моделями
    await init_beanie(
        database=client.enter_code_site,
        document_models=[User]
    )
    
    print("База данных успешно инициализирована")


async def close_database():
    """Закрытие подключения к базе данных"""
    # Beanie автоматически управляет подключениями
    print("Подключение к базе данных закрыто") 
"""
Скрипт миграции для добавления полей абонемента к существующим пользователям-студентам
"""
import asyncio
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from models.user import User, UserType, SubscriptionStatus

async def migrate_user_subscriptions():
    """Добавить поля абонемента всем существующим студентам."""
    
    # Подключение к базе данных
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    database = client.get_database("enter_code_site")
    
    # Инициализация Beanie
    await init_beanie(database=database, document_models=[User])
    
    # Найти всех студентов без полей абонемента
    students = await User.find(User.user_type == UserType.STUDENT).to_list()
    
    print(f"Найдено {len(students)} студентов для миграции")
    
    updated_count = 0
    for student in students:
        # Проверить, есть ли уже поля абонемента
        if not hasattr(student, 'subscription_status'):
            # Добавить поля абонемента с значениями по умолчанию
            student.subscription_status = SubscriptionStatus.UNPAID
            student.lessons_remaining = 0
            
            await student.save()
            updated_count += 1
            print(f"Обновлен студент: {student.full_name}")
    
    print(f"Миграция завершена. Обновлено {updated_count} студентов")

if __name__ == "__main__":
    asyncio.run(migrate_user_subscriptions())

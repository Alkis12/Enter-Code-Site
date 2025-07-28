from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field
import uuid

class UserType(str, Enum):
    """Перечисление типов пользователей."""
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class UserStatus(str, Enum):
    """Перечисление статусов пользователя."""
    ACTIVE = "active"
    INACTIVE = "inactive"


class SubscriptionStatus(str, Enum):
    """Перечисление статусов абонемента."""
    PAID = "paid"
    UNPAID = "unpaid"
    EXPIRED = "expired"


class User(Document):
    """Модель пользователя для MongoDB.
    """
    name: str = Field(..., min_length=1, max_length=100, description="Имя пользователя")
    surname: str = Field(..., min_length=1, max_length=100, description="Фамилия пользователя")
    tg_username: str = Field(..., min_length=2, max_length=33, pattern=r"^[a-zA-Z0-9_]{1,50}$", description="Telegram username без @")
    
    user_type: UserType = Field(..., description="Тип пользователя")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="Статус пользователя")
    
    phone: Optional[str] = Field(default=None, max_length=20, unique=True, description="Номер телефона")
    avatar_url: Optional[str] = Field(default=None, description="URL аватара")
    bio: Optional[str] = Field(default=None, max_length=500, description="Краткая биография")
    
    access_token: Optional[str] = Field(default=None, description="Токен доступа пользователя")
    refresh_token: Optional[str] = Field(default=None, description="Токен для обновления доступа")
    password_hash: str = Field(..., description="Хэш пароля пользователя")
    
    # Поля для абонемента (только для студентов)
    subscription_status: SubscriptionStatus = Field(default=SubscriptionStatus.UNPAID, description="Статус абонемента")
    lessons_remaining: int = Field(default=0, description="Количество оставшихся занятий")
    
    def is_active(self) -> bool:
        """Проверить, активен ли пользователь."""
        return self.status == UserStatus.ACTIVE
    
    def has_valid_subscription(self) -> bool:
        """Проверить, есть ли у студента действующий абонемент."""
        if self.user_type != UserType.STUDENT:
            return True  # Преподаватели и админы всегда имеют доступ
        
        # Проверяем, что абонемент оплачен и есть оставшиеся занятия
        return (self.subscription_status == SubscriptionStatus.PAID and 
                self.lessons_remaining > 0)
    
    def use_lesson(self) -> bool:
        """Использовать одно занятие из абонемента. Возвращает True, если успешно."""
        if not self.has_valid_subscription():
            return False
        
        if self.lessons_remaining > 0:
            self.lessons_remaining -= 1
            if self.lessons_remaining == 0:
                self.subscription_status = SubscriptionStatus.EXPIRED
            return True
        
        return False
    
    def extend_subscription(self, lessons_count: int) -> None:
        """Продлить абонемент на указанное количество занятий."""
        self.lessons_remaining += lessons_count
        self.subscription_status = SubscriptionStatus.PAID
    
    def __str__(self):
        return f"{self.full_name} ({self.tg_username}) - {self.user_type.value.capitalize()} - {self.status.value.capitalize()}"
    
    @property
    def full_name(self) -> str:
        """Вернуть полное имя пользователя."""
        return f"{self.name} {self.surname}"
    
    class Settings:
        name = "users"
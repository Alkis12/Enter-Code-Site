from datetime import datetime
from enum import Enum
from typing import Optional
from beanie import Document
from pydantic import Field, EmailStr
from bson import ObjectId


class UserType(str, Enum):
    STUDENT = "student"
    TEACHER = "teacher"
    ADMIN = "admin"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"


class User(Document):
    id: str = Field(default_factory=lambda: str(ObjectId()), unique=True, description="Уникальный идентификатор пользователя")
    
    name: str = Field(..., min_length=1, max_length=100, description="Имя пользователя")
    surname: str = Field(..., min_length=1, max_length=100, description="Фамилия пользователя")
    email: EmailStr = Field(..., unique=True, description="Email пользователя")
    
    user_type: UserType = Field(..., description="Тип пользователя")
    status: UserStatus = Field(default=UserStatus.ACTIVE, description="Статус пользователя")
    
    phone: Optional[str] = Field(default=None, max_length=20, unique=True, description="Номер телефона")
    avatar_url: Optional[str] = Field(default=None, description="URL аватара")
    bio: Optional[str] = Field(default=None, max_length=500, description="Краткая биография")
    
    def is_active(self) -> bool:
        return self.status == UserStatus.ACTIVE
    
    def __str__(self):
        return f"{self.full_name} ({self.email}) - {self.user_type.value.capitalize()} - {self.status.value.capitalize()}"
    
    @property
    def full_name(self) -> str:
        return f"{self.name} {self.surname}"
    

async def add_user_to_db(user: User):
    await user.insert()
    print(f"Пользователь добавлен в базу данных: {user.full_name}")
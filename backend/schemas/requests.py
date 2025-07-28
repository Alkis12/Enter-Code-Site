from pydantic import BaseModel, Field
from typing import List, Optional
from models.user import UserType

# Запрос на вход
class LoginRequest(BaseModel):
    tg_username: str = Field(..., min_length=2, max_length=33)
    password: str = Field(..., min_length=6)

# Запрос на регистрацию
class RegisterRequest(BaseModel):
    tg_username: str = Field(..., min_length=2, max_length=33)
    password: str = Field(..., min_length=6)
    password_repeat: str = Field(..., min_length=6)
    name: str = Field(..., min_length=1, max_length=100)
    surname: str = Field(..., min_length=1, max_length=100)
    user_type: UserType = Field(default=UserType.STUDENT)
    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = Field(default=None)
    bio: Optional[str] = Field(default=None, max_length=500)

# Базовые запросы аутентификации
class RefreshRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

class UpdateUserRequest(BaseModel):
    tg_username: Optional[str] = Field(default=None, min_length=2, max_length=33, pattern=r"^[a-zA-Z0-9_]{1,50}$")
    phone: Optional[str] = Field(default=None, max_length=20)
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(default=None, max_length=500)

# Запросы для курсов
class CreateCourseRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)

class UpdateCourseRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)

# Запросы для групп
class CreateGroupRequest(BaseModel):
    course_id: str
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)

class UpdateGroupRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)

class AddStudentsToGroupRequest(BaseModel):
    student_usernames: List[str] = Field(..., description="Список Telegram username студентов")

class AddTeachersToGroupRequest(BaseModel):
    teacher_usernames: List[str] = Field(..., description="Список Telegram username преподавателей")

# Запросы для тем
class CreateTopicRequest(BaseModel):
    course_id: str
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=1000)
    resources: List[str] = Field(default_factory=list)

class UpdateTopicRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=1000)
    resources: Optional[List[str]] = None

# Запросы для задач
class CreateTaskRequest(BaseModel):
    topic_id: str
    condition: str = Field(..., min_length=1)
    attachments: List[str] = Field(default_factory=list)

class UpdateTaskRequest(BaseModel):
    condition: Optional[str] = Field(default=None, min_length=1)
    attachments: Optional[List[str]] = None

class SubmitTaskSolutionRequest(BaseModel):
    task_id: str
    solution: str = Field(..., min_length=1)
    attachments: List[str] = Field(default_factory=list)

# Запросы для абонементов
class ExtendSubscriptionRequest(BaseModel):
    tg_username: str = Field(..., description="Telegram username пользователя для продления абонемента")
    lessons_count: int = Field(..., ge=1, description="Количество занятий для добавления")

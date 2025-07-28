from pydantic import BaseModel, Field
from typing import Optional, List
from models.user import UserType, UserStatus, SubscriptionStatus
from models.task import TaskStatus

class UserResponse(BaseModel):
    """Схема ответа для пользователя без sensitive данных"""
    user_id: str = Field(..., description="Уникальный идентификатор пользователя")
    name: str = Field(..., description="Имя пользователя")
    surname: str = Field(..., description="Фамилия пользователя")
    tg_username: str = Field(..., description="Telegram username без символа @")
    user_type: UserType = Field(..., description="Тип пользователя (student, teacher, admin)")
    status: UserStatus = Field(..., description="Статус пользователя (active, inactive)")
    phone: Optional[str] = Field(default=None, description="Номер телефона в международном формате")
    avatar_url: Optional[str] = Field(default=None, description="URL ссылка на аватар пользователя")
    bio: Optional[str] = Field(default=None, description="Краткая биография пользователя")
    
    # Поля абонемента (только для студентов)
    subscription_status: Optional[SubscriptionStatus] = Field(default=None, description="Статус абонемента")
    lessons_remaining: Optional[int] = Field(default=None, description="Количество оставшихся занятий")
    
    class Config:
        from_attributes = True
        
    @property
    def full_name(self) -> str:
        """Вернуть полное имя пользователя."""
        return f"{self.name} {self.surname}"
    
class TokenResponse(BaseModel):
    """Схема ответа с токенами и user_id"""
    access_token: str = Field(..., description="JWT токен доступа для авторизации запросов")
    refresh_token: str = Field(..., description="Refresh токен для обновления токена доступа")
    user_id: str = Field(..., description="Уникальный идентификатор пользователя")

class RegisterResponse(BaseModel):
    """Схема ответа для регистрации"""
    message: str = Field(..., description="Сообщение об успешной регистрации")
    success: bool = Field(..., description="Флаг успешности операции")
    access_token: str = Field(..., description="JWT токен доступа для авторизации запросов")
    refresh_token: str = Field(..., description="Refresh токен для обновления токена доступа")
    user_id: str = Field(..., description="Уникальный идентификатор пользователя")

class MessageResponse(BaseModel):
    """Схема ответа с сообщением"""
    message: str = Field(..., description="Информационное сообщение о результате операции")
    success: bool = Field(default=True, description="Статус успешности операции")

class CourseResponse(BaseModel):
    """Схема ответа для курса"""
    id: str = Field(..., description="Уникальный идентификатор курса")
    name: str = Field(..., description="Название курса")
    description: str = Field(..., description="Описание курса")
    group_ids: List[str] = Field(default_factory=list, description="Список идентификаторов групп в курсе")
    topic_ids: List[str] = Field(default_factory=list, description="Список идентификаторов тем в курсе")
    total_tasks: Optional[int] = Field(default=None, description="Общее количество задач в курсе")
    total_students: Optional[int] = Field(default=None, description="Общее количество студентов в курсе")

class GroupResponse(BaseModel):
    """Схема ответа для группы"""
    id: str = Field(..., description="Уникальный идентификатор группы")
    course_id: str = Field(..., description="Идентификатор курса, к которому относится группа")
    name: str = Field(..., description="Название группы")
    description: str = Field(..., description="Описание группы")
    students: List[str] = Field(default_factory=list, description="Список Telegram username студентов в группе")
    teachers: List[str] = Field(default_factory=list, description="Список Telegram username преподавателей в группе")
    total_students: Optional[int] = Field(default=None, description="Общее количество студентов в группе")

class TopicResponse(BaseModel):
    """Схема ответа для темы"""
    id: str = Field(..., description="Уникальный идентификатор темы")
    course_id: str = Field(..., description="Идентификатор курса, к которому относится тема")
    name: str = Field(..., description="Название темы")
    description: str = Field(..., description="Описание темы")
    resources: List[str] = Field(default_factory=list, description="Список учебных ресурсов по теме")
    task_ids: List[str] = Field(default_factory=list, description="Список идентификаторов задач в теме")
    total_tasks: Optional[int] = Field(default=None, description="Общее количество задач в теме")

class TaskResultResponse(BaseModel):
    """Схема ответа для результата задачи"""
    tg_username: str = Field(..., description="Telegram username пользователя")
    score: float = Field(..., description="Оценка за задачу (от 0 до 100)")
    status: TaskStatus = Field(..., description="Статус выполнения задачи")

class TaskResponse(BaseModel):
    """Схема ответа для задачи"""
    id: str = Field(..., description="Уникальный идентификатор задачи")
    topic_id: str = Field(..., description="Идентификатор темы, к которой относится задача")
    condition: str = Field(..., description="Условие задачи")
    attachments: List[str] = Field(default_factory=list, description="Список файлов, прикрепленных к задаче")
    results: List[TaskResultResponse] = Field(default_factory=list, description="Результаты выполнения задачи студентами")

class ErrorResponse(BaseModel):
    """Схема ответа с ошибкой"""
    error: str = Field(..., description="Описание ошибки")
    detail: Optional[str] = Field(default=None, description="Дополнительная информация об ошибке")
    code: Optional[int] = Field(default=None, description="Код ошибки")

class SubscriptionResponse(BaseModel):
    """Схема ответа с информацией об абонементе"""
    tg_username: str = Field(..., description="Telegram username пользователя")
    subscription_status: SubscriptionStatus = Field(..., description="Статус абонемента")
    lessons_remaining: int = Field(..., description="Количество оставшихся занятий")
    has_valid_subscription: bool = Field(..., description="Есть ли действующий абонемент")

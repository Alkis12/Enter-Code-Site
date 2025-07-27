from typing import List, Dict, Any
from beanie import Document
from pydantic import Field
from enum import Enum

class TaskStatus(str, Enum):
    NO_ATTEMPTS = "нет попыток"
    WRONG_ANSWER = "неправильное решение"
    UNDER_REVIEW = "на проверке"
    REJECTED = "решение отклонено"
    CORRECT = "верное решение"

class TaskResult(Document):
    user_id: str = Field(..., description="ID пользователя")
    score: float = Field(default=0.0, description="Оценка за задачу")
    status: TaskStatus = Field(default=TaskStatus.NO_ATTEMPTS, description="Статус задачи для пользователя")

class Task(Document):
    """
    Задача: принадлежит теме (topic_id), содержит условие и результаты пользователей.
    """
    topic_id: str = Field(..., description="ID темы")
    condition: str = Field(..., description="Условие задачи")
    attachments: List[str] = Field(default_factory=list, description="Список приложенных файлов")
    chat_history: List[Dict[str, Any]] = Field(default_factory=list, description="История чата с ИИ")
    results: List[TaskResult] = Field(default_factory=list, description="Результаты для каждого ученика")

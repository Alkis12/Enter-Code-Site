from typing import List
from beanie import Document
from pydantic import Field
from models.task import Task, TaskStatus
from models.topic import Topic
from models.group import Group

class Course(Document):
    """
    Курс: содержит группы (group_ids) и темы (topic_ids).
    Все пользователи (студенты, преподаватели) привязаны к группам, а не к курсу напрямую.
    """
    name: str = Field(..., description="Название курса")
    description: str = Field(default="", description="Описание курса")
    group_ids: List[str] = Field(default_factory=list, description="Список ID групп в курсе")
    topic_ids: List[str] = Field(default_factory=list, description="Список ID тем в курсе")

    async def get_total_tasks(self) -> int:
        """Возвращает общее количество задач в курсе"""
        count = 0
        for topic_id in self.topic_ids:
            topic = await Topic.get(topic_id)
            if topic:
                count += len(topic.task_ids)
        return count

    async def get_total_students(self) -> int:
        """Возвращает общее количество студентов во всех группах курса"""
        count = 0
        for group_id in self.group_ids:
            group = await Group.get(group_id)
            if group:
                count += len(group.students)
        return count

    async def get_user_success_percent(self, user_id: str) -> float:
        """Возвращает процент успешно выполненных задач для студента в курсе"""
        total = await self.get_total_tasks()
        if total == 0:
            return 0.0
        solved = 0
        for topic_id in self.topic_ids:
            topic = await Topic.get(topic_id)
            if topic:
                solved += await topic.get_user_solved_count(user_id)
        return solved / total * 100

    class Settings:
        name = "courses"
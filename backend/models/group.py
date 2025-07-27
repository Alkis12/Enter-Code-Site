from typing import List
from beanie import Document
from pydantic import Field

class Group(Document):
    """
    Группа: принадлежит курсу (course_id), содержит студентов и преподавателей (user_id).
    """
    course_id: str = Field(..., description="ID курса, к которому относится группа")
    name: str = Field(..., description="Название группы")
    students: List[str] = Field(default_factory=list, description="Список ID студентов в группе")
    teachers: List[str] = Field(default_factory=list, description="Список ID преподавателей в группе")
    description: str = Field(default="", description="Описание группы")

    async def get_total_students(self) -> int:
        """Возвращает общее количество студентов в группе"""
        return len(self.students)

    async def get_user_success_percent(self, user_id: str) -> float:
        """Возвращает процент успешно выполненных задач для студента в группе"""
        from models.topic import Topic
        total = 0
        solved = 0
        course = await self.get(self.course_id)
        if course:
            for topic_id in course.topic_ids:
                topic = await Topic.get(topic_id)
                if topic:
                    total += len(topic.task_ids)
                    solved += await topic.get_user_solved_count(user_id)
        return (solved / total * 100) if total > 0 else 0.0

    class Settings:
        name = "groups"
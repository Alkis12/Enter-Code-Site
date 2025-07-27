from typing import List
from beanie import Document
from pydantic import Field

class Topic(Document):
    """
    Тема: принадлежит курсу (course_id), содержит задачи (task_ids).
    """
    course_id: str = Field(..., description="ID курса, к которому относится тема")
    name: str = Field(..., description="Название темы")
    description: str = Field(default="", description="Описание темы")
    resources: List[str] = Field(default_factory=list, description="Список ресурсов")
    task_ids: List[str] = Field(default_factory=list, description="Список ID задач в теме")

    async def get_total_tasks(self) -> int:
        return len(self.task_ids)

    async def get_user_solved_count(self, user_id: str) -> int:
        from models.task import Task, TaskStatus
        count = 0
        for task_id in self.task_ids:
            task = await Task.get(task_id)
            if task:
                for r in task.results:
                    if r.user_id == user_id and r.status == TaskStatus.CORRECT:
                        count += 1
                        break
        return count

    async def get_user_success_percent(self, user_id: str) -> float:
        total = await self.get_total_tasks()
        if total == 0:
            return 0.0
        solved = await self.get_user_solved_count(user_id)
        return solved / total * 100

from datetime import datetime
from typing import List

from beanie import Document
from pydantic import Field


class Topic(Document):
    course_id: str = Field(...)
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    content: str = Field(default="", max_length=30000)
    resources: List[str] = Field(default_factory=list)
    task_ids: List[str] = Field(default_factory=list)
    order: int = Field(default=0, ge=0)
    is_open: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    async def get_total_tasks(self) -> int:
        return len(self.task_ids)

    async def get_total_points(self) -> int:
        from models.task import Task

        total = 0
        for task_id in self.task_ids:
            task = await Task.get(task_id)
            if task:
                total += task.points
        return total

    async def get_user_points(self, user_id: str) -> int:
        from models.task import Task

        total = 0
        for task_id in self.task_ids:
            task = await Task.get(task_id)
            if task:
                total += task.get_score_for_student(user_id)
        return total

    async def get_user_solved_count(self, user_id: str) -> int:
        from models.task import Task
        from models.task import TaskStatus

        solved = 0
        for task_id in self.task_ids:
            task = await Task.get(task_id)
            if task and task.get_status_for_student(user_id) == TaskStatus.CORRECT:
                solved += 1
        return solved

    async def get_user_success_percent(self, user_id: str) -> float:
        total_points = await self.get_total_points()
        if total_points <= 0:
            return 0.0
        user_points = await self.get_user_points(user_id)
        return round(user_points / total_points * 100, 2)

    class Settings:
        name = "topics"

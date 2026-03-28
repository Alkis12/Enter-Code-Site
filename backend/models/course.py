from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import Field


class Course(Document):
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    public_info: str = Field(default="", max_length=12000)
    group_ids: List[str] = Field(default_factory=list)
    topic_ids: List[str] = Field(default_factory=list)
    teacher_ids: List[str] = Field(default_factory=list)
    student_ids: List[str] = Field(default_factory=list)
    accent_color: str = Field(default="#16a085", max_length=20)
    cover_image: str = Field(default="")
    programming_language: str = Field(default="python", max_length=20)
    schedule_weekdays: List[int] = Field(default_factory=list)
    schedule_start_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    schedule_end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    async def get_total_tasks(self) -> int:
        from models.topic import Topic

        total = 0
        for topic_id in self.topic_ids:
            topic = await Topic.get(topic_id)
            if topic:
                total += len(topic.task_ids)
        return total

    async def get_total_points(self) -> int:
        from models.topic import Topic

        total = 0
        for topic_id in self.topic_ids:
            topic = await Topic.get(topic_id)
            if topic:
                total += await topic.get_total_points()
        return total

    async def get_total_students(self) -> int:
        return len(set(self.student_ids))

    async def get_user_points(self, user_id: str) -> int:
        from models.topic import Topic

        total = 0
        for topic_id in self.topic_ids:
            topic = await Topic.get(topic_id)
            if topic:
                total += await topic.get_user_points(user_id)
        return total

    async def get_user_success_percent(self, user_id: str) -> float:
        total_points = await self.get_total_points()
        if total_points <= 0:
            return 0.0
        user_points = await self.get_user_points(user_id)
        return round(user_points / total_points * 100, 2)

    class Settings:
        name = "courses"

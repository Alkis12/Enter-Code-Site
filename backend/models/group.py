from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field


class GroupScheduleSlot(BaseModel):
    weekday: int = Field(..., ge=0, le=6)
    start_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    end_time: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class Group(Document):
    course_id: str = Field(...)
    name: str = Field(...)
    students: List[str] = Field(default_factory=list)
    teachers: List[str] = Field(default_factory=list)
    description: str = Field(default="")
    schedule_slots: List[GroupScheduleSlot] = Field(default_factory=list)

    async def get_total_students(self) -> int:
        return len(self.students)

    async def get_user_success_percent(self, user_id: str) -> float:
        from models.course import Course
        from models.topic import Topic

        total = 0
        solved = 0
        course = await Course.get(self.course_id)
        if course:
            for topic_id in course.topic_ids:
                topic = await Topic.get(topic_id)
                if topic:
                    total += len(topic.task_ids)
                    solved += await topic.get_user_solved_count(user_id)
        return (solved / total * 100) if total > 0 else 0.0

    class Settings:
        name = "groups"

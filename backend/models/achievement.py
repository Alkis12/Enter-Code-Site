from datetime import datetime
from enum import Enum
from typing import Optional

from beanie import Document
from pydantic import Field


class AchievementTrigger(str, Enum):
    FIRST_LOGIN = "first_login"
    FIRST_SUBMISSION = "first_submission"
    FIRST_SOLVED_TASK = "first_solved_task"


class Achievement(Document):
    key: str = Field(..., min_length=1, max_length=100)
    title: str = Field(..., min_length=1, max_length=150)
    description: str = Field(default="", max_length=500)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    is_hidden: bool = Field(default=False)
    course_id: Optional[str] = Field(default=None)
    trigger: AchievementTrigger = Field(...)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    class Settings:
        name = "achievements"

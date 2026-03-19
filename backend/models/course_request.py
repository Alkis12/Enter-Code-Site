from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field


class CourseRequest(Document):
    course_id: str = Field(...)
    course_name: str = Field(..., min_length=1, max_length=200)
    contact_name: Optional[str] = Field(default=None, max_length=120)
    contact_value: str = Field(..., min_length=3, max_length=300)
    comment: Optional[str] = Field(default=None, max_length=2000)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "course_requests"

from datetime import datetime
from typing import List

from beanie import Document
from pydantic import BaseModel, Field


class AttendanceEntry(BaseModel):
    student_id: str = Field(...)
    present: bool = Field(default=False)
    paid: bool = Field(default=False)
    note: str = Field(default="", max_length=500)


class AttendanceSession(Document):
    course_id: str = Field(...)
    group_id: str = Field(...)
    date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    original_date: str | None = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")
    start_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    end_time: str | None = Field(default=None, pattern=r"^\d{2}:\d{2}$")
    is_cancelled: bool = Field(default=False)
    entries: List[AttendanceEntry] = Field(default_factory=list)
    comment: str = Field(default="", max_length=2000)
    created_by: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def touch(self) -> None:
        self.updated_at = datetime.utcnow()

    class Settings:
        name = "attendance_sessions"
